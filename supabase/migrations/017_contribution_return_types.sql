-- =====================================================================================
-- 017_contribution_return_types.sql — Tipos de rendimiento por aporte + editar aportes
-- =====================================================================================
-- Solo toca el módulo de inversiones.
--   return_type = 'tasa'        → cuota = capital × tasa mensual (comportamiento actual)
--               = 'monto_fijo'  → cuota fija mensual (fixed_amount_cents) mientras haya capital
--               = 'sin_interes' → no genera cuotas; solo se controla el capital y sus devoluciones
-- update_contribution: datos no financieros se editan en el lugar; si cambian monto, fecha,
-- tipo, tasa, monto fijo, día ancla o gracia, se CORRIGE (anula + registra nuevo, atómico).
-- Idempotente.
-- =====================================================================================

alter table public.contributions add column if not exists return_type text not null default 'tasa';
alter table public.contributions add column if not exists fixed_amount_cents bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contributions_return_type_check') then
    alter table public.contributions add constraint contributions_return_type_check
      check (return_type in ('tasa','monto_fijo','sin_interes'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contributions_fixed_amount_check') then
    alter table public.contributions add constraint contributions_fixed_amount_check
      check ((return_type = 'monto_fijo') = (fixed_amount_cents is not null and fixed_amount_cents > 0));
  end if;
end $$;

-- ------------------------------------------------------------------ monto de un periodo según el tipo
create or replace function public.inv_contribution_period_amount(
  p_contribution uuid, p_start date, p_end date, p_rate numeric, p_mode text)
returns bigint
language plpgsql stable
set search_path = ''
as $$
declare
  v_type  text;
  v_fixed bigint;
begin
  select return_type, fixed_amount_cents into v_type, v_fixed
    from public.contributions where id = p_contribution;
  if v_type = 'sin_interes' then return 0; end if;
  if v_type = 'monto_fijo' then
    return case when public.inv_capital_at(p_contribution, p_start) > 0 then v_fixed else 0 end;
  end if;
  return public.inv_period_interest(p_contribution, p_start, p_end, p_rate, p_mode);
end;
$$;

-- ------------------------------------------------------------------ recálculo (con tipos)
create or replace function public._inv_recompute_contribution(p_contribution uuid)
returns integer
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_mode   text;
  v_status text;
  v_type   text;
  s        record;
  v_rate   numeric;
  v_base   bigint;
  v_amount bigint;
  v_count  integer := 0;
begin
  select l.interest_on_return_mode, c.status, c.return_type
    into v_mode, v_status, v_type
    from public.contributions c
    join public.investment_lines l on l.id = c.line_id
   where c.id = p_contribution;
  if v_status is distinct from 'activo' and v_status is distinct from 'liquidado' then
    return 0;
  end if;

  for s in
    select * from public.interest_schedules
     where contribution_id = p_contribution
       and amount_paid_cents = 0 and amount_waived_cents = 0
       and status in ('programada','anulada')
     order by period_number
  loop
    v_rate := case when v_type = 'tasa' then public.inv_rate_for_period(p_contribution, s.period_number) else 0 end;
    v_base := public.inv_capital_at(p_contribution, s.period_start);
    v_amount := public.inv_contribution_period_amount(p_contribution, s.period_start, s.due_date, v_rate, v_mode);

    if v_amount <= 0 and v_base <= 0 then
      update public.interest_schedules
         set base_capital_cents = 0, rate = v_rate, amount_due_cents = 0, status = 'anulada'
       where id = s.id and (status <> 'anulada' or amount_due_cents <> 0);
    else
      update public.interest_schedules
         set base_capital_cents = v_base, rate = v_rate, amount_due_cents = v_amount, status = 'programada'
       where id = s.id
         and (base_capital_cents, rate, amount_due_cents, status)
             is distinct from (v_base, v_rate, v_amount, 'programada');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ------------------------------------------------------------------ generación de cuotas (con tipos)
create or replace function public._inv_ensure_schedules(p_line uuid)
returns integer
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line     public.investment_lines%rowtype;
  v_today    date := public.inv_today();
  c          record;
  v_k        integer;
  v_last_due date;
  v_start    date;
  v_due      date;
  v_rate     numeric;
  v_base     bigint;
  v_amount   bigint;
  v_sched    uuid;
  v_new      integer := 0;
begin
  select * into v_line from public.investment_lines where id = p_line for update;
  if not found then
    raise exception 'Línea de inversión no encontrada' using errcode = 'P0002';
  end if;
  if v_line.status = 'cerrada' then return 0; end if;

  for c in
    select * from public.contributions
     where line_id = p_line and status = 'activo' and return_type <> 'sin_interes'
     order by contributed_at, created_at
  loop
    loop
      select max(period_number), max(due_date)
        into v_k, v_last_due
        from public.interest_schedules
       where contribution_id = c.id;
      exit when v_last_due is not null and v_last_due > v_today;

      v_k := coalesce(v_k, 0) + 1;
      exit when v_k > 600;

      select b.period_start, b.due_date into v_start, v_due
        from public.inv_period_bounds(c.contributed_at, c.anchor_day, c.grace_months, v_k) b;
      v_base := public.inv_capital_at(c.id, v_start);
      exit when v_base <= 0;

      v_rate := case when c.return_type = 'tasa' then public.inv_rate_for_period(c.id, v_k) else 0 end;
      v_amount := public.inv_contribution_period_amount(c.id, v_start, v_due, v_rate, v_line.interest_on_return_mode);

      insert into public.interest_schedules
        (contribution_id, line_id, period_number, period_start, due_date,
         base_capital_cents, rate, amount_due_cents)
      values (c.id, p_line, v_k, v_start, v_due, v_base, v_rate, v_amount)
      on conflict (contribution_id, period_number) do nothing
      returning id into v_sched;

      if v_sched is not null then
        v_new := v_new + 1;
        perform public._inv_apply_credit(p_line, v_sched);
      end if;
    end loop;
  end loop;

  perform public._inv_refresh_statuses(p_line);
  return v_new;
end;
$$;

-- ------------------------------------------------------------------ registrar aporte (nueva firma)
drop function if exists public.register_contribution(uuid, bigint, date, numeric, integer, integer, text, text, text, text, text, text, boolean);
drop function if exists public._inv_register_contribution(uuid, uuid, bigint, date, numeric, integer, integer, text, text, text, text, text, text, boolean);

create or replace function public._inv_register_contribution(
  p_actor              uuid,
  p_line_id            uuid,
  p_amount_cents       bigint,
  p_contributed_at     date,
  p_monthly_rate       numeric default null,
  p_anchor_day         integer default null,
  p_grace_months       integer default 0,
  p_method             text    default 'transferencia',
  p_source_bank        text    default null,
  p_operation_code     text    default null,
  p_voucher_path       text    default null,
  p_voucher_hash       text    default null,
  p_notes              text    default null,
  p_dry_run            boolean default false,
  p_return_type        text    default 'tasa',
  p_fixed_amount_cents bigint  default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line      public.investment_lines%rowtype;
  v_type      text := coalesce(p_return_type, 'tasa');
  v_rate      numeric;
  v_fixed     bigint;
  v_anchor    integer;
  v_grace     integer := coalesce(p_grace_months, 0);
  v_delivered bigint;
  v_warnings  jsonb;
  v_first     record;
  v_preview   jsonb;
  v_id        uuid;
begin
  perform public._inv_set_actor(p_actor);
  if public._inv_line_role(p_line_id, p_actor) is distinct from 'investor' then
    raise exception 'Solo el inversionista registra aportes de capital' using errcode = '42501';
  end if;
  select * into v_line from public.investment_lines where id = p_line_id for update;
  if v_line.status = 'cerrada' then raise exception 'La línea está cerrada'; end if;

  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_contributed_at is null then raise exception 'Indica la fecha del aporte'; end if;
  if p_contributed_at > public.inv_today() then raise exception 'La fecha del aporte no puede ser futura'; end if;
  if p_method = 'reinversion' then raise exception 'La reinversión se registra desde una cuota pagada'; end if;
  if p_method not in ('yape','plin','transferencia','efectivo','otro') then raise exception 'Método no válido'; end if;
  if v_grace < 0 or v_grace > 24 then raise exception 'La gracia debe estar entre 0 y 24 meses'; end if;
  if v_type not in ('tasa','monto_fijo','sin_interes') then raise exception 'Tipo de rendimiento no válido'; end if;

  if v_type = 'tasa' then
    v_rate := coalesce(p_monthly_rate, v_line.default_monthly_rate);
    if v_rate < 0 or v_rate > 1 then raise exception 'La tasa mensual debe estar entre 0 %% y 100 %%'; end if;
  else
    v_rate := 0;
  end if;
  if v_type = 'monto_fijo' then
    if p_fixed_amount_cents is null or p_fixed_amount_cents <= 0 then
      raise exception 'Indica el monto fijo mensual';
    end if;
    v_fixed := p_fixed_amount_cents;
  end if;

  v_anchor := coalesce(p_anchor_day, extract(day from p_contributed_at)::int);
  if v_anchor < 1 or v_anchor > 31 then raise exception 'El día ancla debe estar entre 1 y 31'; end if;

  select coalesce(sum(amount_cents), 0) into v_delivered
    from public.contributions where line_id = p_line_id and status <> 'anulado';

  v_warnings := public._inv_duplicate_warnings(p_line_id, p_method, p_operation_code, p_voucher_hash);
  if v_line.committed_amount_cents > 0 and v_delivered + p_amount_cents > v_line.committed_amount_cents then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'cupo_excedido',
      'message', 'Con este aporte entregarías ' || public.inv_fmt(v_delivered + p_amount_cents, v_line.currency)
                 || ' y el cupo es ' || public.inv_fmt(v_line.committed_amount_cents, v_line.currency),
      'delivered_after_cents', v_delivered + p_amount_cents,
      'committed_cents', v_line.committed_amount_cents,
      'excess_cents', v_delivered + p_amount_cents - v_line.committed_amount_cents));
  end if;

  select * into v_first from public.inv_period_bounds(p_contributed_at, v_anchor, v_grace, 1);
  v_preview := jsonb_build_object(
    'return_type', v_type,
    'monthly_interest_cents', case v_type when 'tasa' then round(p_amount_cents * v_rate)::bigint
                                          when 'monto_fijo' then v_fixed else 0 end,
    'monthly_rate', v_rate,
    'anchor_day', v_anchor,
    'first_period_start', v_first.period_start,
    'first_due_date', case when v_type = 'sin_interes' then null else v_first.due_date end,
    'delivered_before_cents', v_delivered,
    'delivered_after_cents', v_delivered + p_amount_cents,
    'committed_cents', v_line.committed_amount_cents);

  if coalesce(p_dry_run, false) then
    return jsonb_build_object('dry_run', true, 'warnings', v_warnings, 'preview', v_preview);
  end if;

  insert into public.contributions (
    line_id, amount_cents, contributed_at, anchor_day, monthly_rate, grace_months, method,
    source_bank, operation_code, voucher_path, voucher_hash, notes, created_by,
    return_type, fixed_amount_cents)
  values (
    p_line_id, p_amount_cents, p_contributed_at, v_anchor, v_rate, v_grace, p_method,
    nullif(btrim(p_source_bank), ''), nullif(btrim(p_operation_code), ''),
    nullif(p_voucher_path, ''), nullif(p_voucher_hash, ''), nullif(btrim(p_notes), ''), p_actor,
    v_type, v_fixed)
  returning id into v_id;

  perform public._inv_ensure_schedules(p_line_id);

  return jsonb_build_object('dry_run', false, 'contribution_id', v_id, 'warnings', v_warnings, 'preview', v_preview);
end;
$$;

create or replace function public.register_contribution(
  p_line_id            uuid,
  p_amount_cents       bigint,
  p_contributed_at     date,
  p_monthly_rate       numeric default null,
  p_anchor_day         integer default null,
  p_grace_months       integer default 0,
  p_method             text    default 'transferencia',
  p_source_bank        text    default null,
  p_operation_code     text    default null,
  p_voucher_path       text    default null,
  p_voucher_hash       text    default null,
  p_notes              text    default null,
  p_dry_run            boolean default false,
  p_return_type        text    default 'tasa',
  p_fixed_amount_cents bigint  default null)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_register_contribution(public._inv_require_uid(), p_line_id, p_amount_cents, p_contributed_at,
    p_monthly_rate, p_anchor_day, p_grace_months, p_method, p_source_bank, p_operation_code, p_voucher_path,
    p_voucher_hash, p_notes, p_dry_run, p_return_type, p_fixed_amount_cents)
$$;

-- ------------------------------------------------------------------ cambio de tasa (solo aportes con tasa)
create or replace function public._inv_change_rate(
  p_actor           uuid,
  p_new_rate        numeric,
  p_reason          text,
  p_contribution_id uuid    default null,
  p_from_period     integer default null,
  p_line_id         uuid    default null,
  p_effective_date  date    default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line    uuid;
  c         record;
  v_from    integer;
  v_k       integer;
  v_start   date;
  v_changed integer := 0;
begin
  perform public._inv_set_actor(p_actor);
  if p_new_rate is null or p_new_rate < 0 or p_new_rate > 1 then
    raise exception 'La tasa mensual debe estar entre 0 %% y 100 %%';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Indica el motivo del cambio de tasa'; end if;

  if p_contribution_id is not null then
    select line_id into v_line from public.contributions where id = p_contribution_id;
    if exists (select 1 from public.contributions where id = p_contribution_id and return_type <> 'tasa') then
      raise exception 'Este aporte no usa tasa: edítalo para cambiar su monto fijo o tipo';
    end if;
  else
    v_line := p_line_id;
  end if;
  if v_line is null then raise exception 'Indica el aporte o la línea'; end if;
  if public._inv_line_role(v_line, p_actor) is distinct from 'investor' then
    raise exception 'Solo el inversionista puede cambiar la tasa' using errcode = '42501';
  end if;
  perform 1 from public.investment_lines where id = v_line for update;
  perform public._inv_ensure_schedules(v_line);

  for c in
    select * from public.contributions
     where line_id = v_line and status = 'activo' and return_type = 'tasa'
       and (p_contribution_id is null or id = p_contribution_id)
  loop
    if p_contribution_id is not null then
      v_from := coalesce(p_from_period, 1);
      if v_from < 1 then raise exception 'El periodo inicial debe ser 1 o mayor'; end if;
    else
      if p_effective_date is null then raise exception 'Indica desde qué fecha aplica la nueva tasa'; end if;
      v_k := 1;
      loop
        select b.period_start into v_start
          from public.inv_period_bounds(c.contributed_at, c.anchor_day, c.grace_months, v_k) b;
        exit when v_start >= p_effective_date or v_k > 600;
        v_k := v_k + 1;
      end loop;
      v_from := v_k;
    end if;

    if exists (select 1 from public.interest_schedules s
                where s.contribution_id = c.id and s.period_number >= v_from
                  and (s.amount_paid_cents > 0 or s.amount_waived_cents > 0)) then
      raise exception 'El aporte del % ya tiene pagos desde el periodo %: la tasa no se cambia sobre cuotas pagadas',
        to_char(c.contributed_at, 'DD/MM/YYYY'), v_from;
    end if;

    insert into public.rate_changes (line_id, contribution_id, from_period, old_rate, new_rate, reason, created_by)
    values (v_line, c.id, v_from, public.inv_rate_for_period(c.id, v_from), p_new_rate, btrim(p_reason), p_actor);
    perform public._inv_recompute_contribution(c.id);
    v_changed := v_changed + 1;
  end loop;

  if p_contribution_id is not null and v_changed = 0 then
    raise exception 'El aporte no está activo';
  end if;
  if p_contribution_id is null then
    update public.investment_lines set default_monthly_rate = p_new_rate where id = v_line;
  end if;

  perform public._inv_refresh_statuses(v_line);
  perform public._inv_ensure_schedules(v_line);
  return jsonb_build_object('contributions_changed', v_changed);
end;
$$;

-- ------------------------------------------------------------------ editar / corregir aporte
create or replace function public._inv_update_contribution(
  p_actor              uuid,
  p_contribution_id    uuid,
  p_amount_cents       bigint,
  p_contributed_at     date,
  p_return_type        text,
  p_monthly_rate       numeric,
  p_fixed_amount_cents bigint,
  p_anchor_day         integer,
  p_grace_months       integer,
  p_method             text,
  p_source_bank        text,
  p_operation_code     text,
  p_notes              text,
  p_reason             text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  c          public.contributions%rowtype;
  v_type     text := coalesce(p_return_type, 'tasa');
  v_rate     numeric := case when coalesce(p_return_type, 'tasa') = 'tasa' then p_monthly_rate else 0 end;
  v_fixed    bigint := case when p_return_type = 'monto_fijo' then p_fixed_amount_cents end;
  v_anchor   integer;
  v_financial boolean;
  v_result   jsonb;
begin
  perform public._inv_set_actor(p_actor);
  select * into c from public.contributions where id = p_contribution_id;
  if not found then raise exception 'Aporte no encontrado' using errcode = 'P0002'; end if;
  if public._inv_line_role(c.line_id, p_actor) is distinct from 'investor' then
    raise exception 'Solo el inversionista edita sus aportes' using errcode = '42501';
  end if;
  if c.status = 'anulado' then raise exception 'El aporte está anulado'; end if;
  if c.recon_status = 'confirmado' then
    raise exception 'El aporte ya fue confirmado por el gestor: no se edita (fase 2: anulación bilateral)';
  end if;
  if p_method is not null and p_method not in ('yape','plin','transferencia','efectivo','otro') then
    raise exception 'Método no válido';
  end if;

  v_anchor := coalesce(p_anchor_day, extract(day from coalesce(p_contributed_at, c.contributed_at))::int);
  v_financial :=
       p_amount_cents is distinct from c.amount_cents
    or p_contributed_at is distinct from c.contributed_at
    or v_type is distinct from c.return_type
    or (v_type = 'tasa' and v_rate is distinct from c.monthly_rate)
    or (v_type = 'monto_fijo' and v_fixed is distinct from c.fixed_amount_cents)
    or v_anchor is distinct from c.anchor_day
    or coalesce(p_grace_months, 0) is distinct from c.grace_months;

  if not v_financial then
    perform 1 from public.investment_lines where id = c.line_id for update;
    update public.contributions
       set method = coalesce(p_method, method),
           source_bank = nullif(btrim(p_source_bank), ''),
           operation_code = nullif(btrim(p_operation_code), ''),
           notes = nullif(btrim(p_notes), '')
     where id = c.id;
    return jsonb_build_object('contribution_id', c.id, 'corrected', false);
  end if;

  -- Corrección: anula el original y registra el nuevo en la misma transacción
  if exists (select 1 from public.payment_allocations a
               join public.interest_schedules s on s.id = a.schedule_id
              where s.contribution_id = c.id and a.voided_at is null)
     or exists (select 1 from public.payment_allocations a
                 where a.contribution_id = c.id and a.target_type = 'capital' and a.voided_at is null) then
    raise exception 'Este aporte ya tiene pagos o devoluciones: para cambiar monto, fecha o rendimiento, anula primero esos pagos';
  end if;

  perform public._inv_void_movement(p_actor, 'contribution', c.id,
    'Corregido' || coalesce(': ' || nullif(btrim(p_reason), ''), ''));

  v_result := public._inv_register_contribution(
    p_actor, c.line_id, p_amount_cents, p_contributed_at, v_rate, v_anchor, coalesce(p_grace_months, 0),
    coalesce(p_method, c.method), p_source_bank, p_operation_code, c.voucher_path, c.voucher_hash, p_notes,
    false, v_type, v_fixed);

  return jsonb_build_object('contribution_id', v_result ->> 'contribution_id', 'corrected', true,
                            'replaced_id', c.id, 'warnings', v_result -> 'warnings');
end;
$$;

create or replace function public.update_contribution(
  p_contribution_id    uuid,
  p_amount_cents       bigint,
  p_contributed_at     date,
  p_return_type        text,
  p_monthly_rate       numeric,
  p_fixed_amount_cents bigint,
  p_anchor_day         integer,
  p_grace_months       integer,
  p_method             text,
  p_source_bank        text,
  p_operation_code     text,
  p_notes              text,
  p_reason             text default null)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_update_contribution(public._inv_require_uid(), p_contribution_id, p_amount_cents,
    p_contributed_at, p_return_type, p_monthly_rate, p_fixed_amount_cents, p_anchor_day, p_grace_months,
    p_method, p_source_bank, p_operation_code, p_notes, p_reason)
$$;

-- ------------------------------------------------------------------ permisos
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('inv_contribution_period_amount','_inv_recompute_contribution','_inv_ensure_schedules',
                         '_inv_register_contribution','register_contribution','_inv_change_rate',
                         '_inv_update_contribution','update_contribution')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like '\_inv\_%' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
