-- =====================================================================================
-- 018_commission_loans.sql — Préstamos al 0 % con comisión
-- =====================================================================================
-- Solo toca el módulo de inversiones. Aditiva e idempotente.
--   return_type = 'comision' → préstamo sin intereses con una comisión única (fixed_amount_cents)
--                              que vence en la fecha de pago (repayment_date), igual que el capital.
--   Genera UNA sola cuota (la comisión), de contributed_at a repayment_date. El capital se
--   devuelve con un pago 'capital' o 'mixto' (comisión + capital en el mismo pago).
-- register_contribution y update_contribution reciben p_repayment_date (se reemplazan las
-- firmas de 017 para que PostgREST no tenga sobrecargas ambiguas).
-- =====================================================================================

alter table public.contributions add column if not exists repayment_date date;

do $$
begin
  alter table public.contributions drop constraint if exists contributions_return_type_check;
  alter table public.contributions add constraint contributions_return_type_check
    check (return_type in ('tasa','monto_fijo','sin_interes','comision'));

  alter table public.contributions drop constraint if exists contributions_fixed_amount_check;
  alter table public.contributions add constraint contributions_fixed_amount_check
    check ((return_type in ('monto_fijo','comision')) = (fixed_amount_cents is not null and fixed_amount_cents > 0));

  if not exists (select 1 from pg_constraint where conname = 'contributions_repayment_date_check') then
    alter table public.contributions add constraint contributions_repayment_date_check
      check (return_type <> 'comision' or (repayment_date is not null and repayment_date > contributed_at));
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
  if v_type in ('monto_fijo','comision') then
    return case when public.inv_capital_at(p_contribution, p_start) > 0 then v_fixed else 0 end;
  end if;
  return public.inv_period_interest(p_contribution, p_start, p_end, p_rate, p_mode);
end;
$$;

-- ------------------------------------------------------------------ generación de cuotas (con comisión)
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
    -- Comisión: una sola cuota, del préstamo a la fecha de pago (aunque esa fecha sea futura)
    if c.return_type = 'comision' then
      if not exists (select 1 from public.interest_schedules where contribution_id = c.id) then
        v_base := public.inv_capital_at(c.id, c.contributed_at);
        if v_base > 0 then
          insert into public.interest_schedules
            (contribution_id, line_id, period_number, period_start, due_date,
             base_capital_cents, rate, amount_due_cents)
          values (c.id, p_line, 1, c.contributed_at, c.repayment_date, v_base, 0, c.fixed_amount_cents)
          on conflict (contribution_id, period_number) do nothing
          returning id into v_sched;
          if v_sched is not null then
            v_new := v_new + 1;
            perform public._inv_apply_credit(p_line, v_sched);
          end if;
        end if;
      end if;
      continue;
    end if;

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

      v_sched := null;
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

-- ------------------------------------------------------------------ registrar aporte (con fecha de pago)
drop function if exists public.register_contribution(uuid, bigint, date, numeric, integer, integer, text, text, text, text, text, text, boolean, text, bigint);
drop function if exists public._inv_register_contribution(uuid, uuid, bigint, date, numeric, integer, integer, text, text, text, text, text, text, boolean, text, bigint);

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
  p_fixed_amount_cents bigint  default null,
  p_repayment_date     date    default null)
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
  v_repay     date;
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
  if v_type not in ('tasa','monto_fijo','sin_interes','comision') then raise exception 'Tipo de rendimiento no válido'; end if;

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
  if v_type = 'comision' then
    if p_fixed_amount_cents is null or p_fixed_amount_cents <= 0 then
      raise exception 'Indica el monto de la comisión';
    end if;
    if p_repayment_date is null then raise exception 'Indica la fecha de pago del préstamo'; end if;
    if p_repayment_date <= p_contributed_at then
      raise exception 'La fecha de pago debe ser posterior a la fecha del préstamo';
    end if;
    v_fixed := p_fixed_amount_cents;
    v_repay := p_repayment_date;
    v_grace := 0;
  end if;

  v_anchor := case when v_type = 'comision' then extract(day from v_repay)::int
                   else coalesce(p_anchor_day, extract(day from p_contributed_at)::int) end;
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
    'commission_cents', case when v_type = 'comision' then v_fixed end,
    'repayment_date', v_repay,
    'monthly_rate', v_rate,
    'anchor_day', v_anchor,
    'first_period_start', case when v_type = 'comision' then p_contributed_at else v_first.period_start end,
    'first_due_date', case v_type when 'sin_interes' then null
                                  when 'comision' then v_repay
                                  else v_first.due_date end,
    'delivered_before_cents', v_delivered,
    'delivered_after_cents', v_delivered + p_amount_cents,
    'committed_cents', v_line.committed_amount_cents);

  if coalesce(p_dry_run, false) then
    return jsonb_build_object('dry_run', true, 'warnings', v_warnings, 'preview', v_preview);
  end if;

  insert into public.contributions (
    line_id, amount_cents, contributed_at, anchor_day, monthly_rate, grace_months, method,
    source_bank, operation_code, voucher_path, voucher_hash, notes, created_by,
    return_type, fixed_amount_cents, repayment_date)
  values (
    p_line_id, p_amount_cents, p_contributed_at, v_anchor, v_rate, v_grace, p_method,
    nullif(btrim(p_source_bank), ''), nullif(btrim(p_operation_code), ''),
    nullif(p_voucher_path, ''), nullif(p_voucher_hash, ''), nullif(btrim(p_notes), ''), p_actor,
    v_type, v_fixed, v_repay)
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
  p_fixed_amount_cents bigint  default null,
  p_repayment_date     date    default null)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_register_contribution(public._inv_require_uid(), p_line_id, p_amount_cents, p_contributed_at,
    p_monthly_rate, p_anchor_day, p_grace_months, p_method, p_source_bank, p_operation_code, p_voucher_path,
    p_voucher_hash, p_notes, p_dry_run, p_return_type, p_fixed_amount_cents, p_repayment_date)
$$;

-- ------------------------------------------------------------------ editar / corregir aporte (con fecha de pago)
drop function if exists public.update_contribution(uuid, bigint, date, text, numeric, bigint, integer, integer, text, text, text, text, text);
drop function if exists public._inv_update_contribution(uuid, uuid, bigint, date, text, numeric, bigint, integer, integer, text, text, text, text, text);

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
  p_reason             text default null,
  p_repayment_date     date default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  c          public.contributions%rowtype;
  v_type     text := coalesce(p_return_type, 'tasa');
  v_rate     numeric := case when coalesce(p_return_type, 'tasa') = 'tasa' then p_monthly_rate else 0 end;
  v_fixed    bigint := case when p_return_type in ('monto_fijo','comision') then p_fixed_amount_cents end;
  v_repay    date := case when p_return_type = 'comision' then p_repayment_date end;
  v_grace    integer := case when p_return_type = 'comision' then 0 else coalesce(p_grace_months, 0) end;
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

  v_anchor := case when v_type = 'comision' and v_repay is not null then extract(day from v_repay)::int
                   else coalesce(p_anchor_day, extract(day from coalesce(p_contributed_at, c.contributed_at))::int) end;
  v_financial :=
       p_amount_cents is distinct from c.amount_cents
    or p_contributed_at is distinct from c.contributed_at
    or v_type is distinct from c.return_type
    or (v_type = 'tasa' and v_rate is distinct from c.monthly_rate)
    or (v_type in ('monto_fijo','comision') and v_fixed is distinct from c.fixed_amount_cents)
    or (v_type = 'comision' and v_repay is distinct from c.repayment_date)
    or (v_type <> 'comision' and v_anchor is distinct from c.anchor_day)
    or v_grace is distinct from c.grace_months;

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
    p_actor, c.line_id, p_amount_cents, p_contributed_at, v_rate, v_anchor, v_grace,
    coalesce(p_method, c.method), p_source_bank, p_operation_code, c.voucher_path, c.voucher_hash, p_notes,
    false, v_type, v_fixed, v_repay);

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
  p_reason             text default null,
  p_repayment_date     date default null)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_update_contribution(public._inv_require_uid(), p_contribution_id, p_amount_cents,
    p_contributed_at, p_return_type, p_monthly_rate, p_fixed_amount_cents, p_anchor_day, p_grace_months,
    p_method, p_source_bank, p_operation_code, p_notes, p_reason, p_repayment_date)
$$;

-- ------------------------------------------------------------------ permisos
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('inv_contribution_period_amount','_inv_ensure_schedules',
                         '_inv_register_contribution','register_contribution',
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
