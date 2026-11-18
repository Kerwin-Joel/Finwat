-- =====================================================================================
-- 013_investments_rpc.sql — RPC de inversiones (fase 1)
-- =====================================================================================
-- Patrón: `_inv_xxx(p_actor uuid, ...)` hace el trabajo y valida el rol del actor en la
-- línea; solo la puede ejecutar service_role (el bot, con el user_id resuelto por
-- teléfono/BSUID). El wrapper público `xxx(...)` pasa auth.uid() y es lo que llama la app.
-- Todo es atómico (una RPC = una transacción) y nada se borra.
-- Idempotente.
-- =====================================================================================

-- ==================================================================== líneas
create or replace function public._inv_create_line(
  p_actor                   uuid,
  p_manager_display_name    text,
  p_manager_phone           text    default null,
  p_currency                text    default 'PEN',
  p_committed_amount_cents  bigint  default 0,
  p_default_monthly_rate    numeric default 0.10,
  p_interest_on_return_mode text    default 'periodo_completo',
  p_due_soon_days           integer default 3,
  p_payment_grace_days      integer default 0,
  p_notes                   text    default null)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_phone text := nullif(regexp_replace(coalesce(p_manager_phone, ''), '\D', '', 'g'), '');
begin
  if p_actor is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  perform public._inv_set_actor(p_actor);

  if nullif(btrim(coalesce(p_manager_display_name, '')), '') is null then
    raise exception 'Escribe el nombre del gestor';
  end if;
  if v_phone is not null and length(v_phone) = 9 then
    v_phone := '51' || v_phone;   -- celular peruano sin código de país
  end if;

  insert into public.investment_lines (
    investor_user_id, manager_display_name, manager_phone, currency,
    committed_amount_cents, default_monthly_rate, interest_on_return_mode,
    due_soon_days, payment_grace_days, notes, created_by)
  values (
    p_actor, btrim(p_manager_display_name), v_phone, coalesce(p_currency, 'PEN'),
    coalesce(p_committed_amount_cents, 0), coalesce(p_default_monthly_rate, 0.10),
    coalesce(p_interest_on_return_mode, 'periodo_completo'),
    coalesce(p_due_soon_days, 3), coalesce(p_payment_grace_days, 0), nullif(btrim(p_notes), ''), p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- Ajustes de la línea (solo inversionista). p_patch admite:
-- manager_display_name, manager_phone, committed_amount_cents, default_monthly_rate (solo
-- para aportes futuros; para cambiar cuotas usar change_rate), interest_on_return_mode,
-- due_soon_days, payment_grace_days, notes, reminder_settings.
create or replace function public._inv_update_line(p_actor uuid, p_line_id uuid, p_patch jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line  public.investment_lines%rowtype;
  v_key   text;
  v_phone text;
  c       record;
begin
  perform public._inv_set_actor(p_actor);
  if public._inv_line_role(p_line_id, p_actor) is distinct from 'investor' then
    raise exception 'Solo el inversionista puede cambiar los ajustes de la línea' using errcode = '42501';
  end if;
  select * into v_line from public.investment_lines where id = p_line_id for update;
  if v_line.status = 'cerrada' then raise exception 'La línea está cerrada'; end if;

  for v_key in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if v_key not in ('manager_display_name','manager_phone','committed_amount_cents','default_monthly_rate',
                     'interest_on_return_mode','due_soon_days','payment_grace_days','notes','reminder_settings') then
      raise exception 'Campo no editable: %', v_key;
    end if;
  end loop;

  if p_patch ? 'manager_phone' then
    v_phone := nullif(regexp_replace(coalesce(p_patch ->> 'manager_phone', ''), '\D', '', 'g'), '');
    if v_phone is not null and length(v_phone) = 9 then v_phone := '51' || v_phone; end if;
  end if;

  update public.investment_lines set
    manager_display_name    = case when p_patch ? 'manager_display_name'
                                   then btrim(p_patch ->> 'manager_display_name') else manager_display_name end,
    manager_phone           = case when p_patch ? 'manager_phone' then v_phone else manager_phone end,
    committed_amount_cents  = coalesce((p_patch ->> 'committed_amount_cents')::bigint, committed_amount_cents),
    default_monthly_rate    = coalesce((p_patch ->> 'default_monthly_rate')::numeric, default_monthly_rate),
    interest_on_return_mode = coalesce(p_patch ->> 'interest_on_return_mode', interest_on_return_mode),
    due_soon_days           = coalesce((p_patch ->> 'due_soon_days')::smallint, due_soon_days),
    payment_grace_days      = coalesce((p_patch ->> 'payment_grace_days')::smallint, payment_grace_days),
    notes                   = case when p_patch ? 'notes' then nullif(btrim(p_patch ->> 'notes'), '') else notes end,
    reminder_settings       = coalesce(p_patch -> 'reminder_settings', reminder_settings)
  where id = p_line_id;

  -- Cambiar el modo de devolución recalcula las cuotas aún no pagadas
  if p_patch ? 'interest_on_return_mode'
     and p_patch ->> 'interest_on_return_mode' is distinct from v_line.interest_on_return_mode then
    for c in select id from public.contributions where line_id = p_line_id and status in ('activo','liquidado') loop
      perform public._inv_recompute_contribution(c.id);
    end loop;
    perform public._inv_refresh_statuses(p_line_id);
  end if;

  return public._inv_line_summary(p_line_id);
end;
$$;

create or replace function public._inv_close_line(p_actor uuid, p_line_id uuid, p_reason text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line public.investment_lines%rowtype;
begin
  perform public._inv_set_actor(p_actor);
  if public._inv_line_role(p_line_id, p_actor) is distinct from 'investor' then
    raise exception 'Solo el inversionista puede cerrar la línea' using errcode = '42501';
  end if;
  perform public._inv_ensure_schedules(p_line_id);
  select * into v_line from public.investment_lines where id = p_line_id for update;
  if v_line.status = 'cerrada' then return; end if;
  if exists (select 1 from public.contributions where line_id = p_line_id and status = 'activo') then
    raise exception 'Aún hay capital o intereses pendientes: la línea debe estar liquidada para cerrarla';
  end if;
  update public.investment_lines
     set status = 'cerrada', closed_at = now(),
         notes = case when nullif(btrim(p_reason), '') is null then notes
                      else concat_ws(E'\n', notes, 'Cierre: ' || btrim(p_reason)) end
   where id = p_line_id;
end;
$$;

-- ==================================================================== aportes
create or replace function public._inv_register_contribution(
  p_actor          uuid,
  p_line_id        uuid,
  p_amount_cents   bigint,
  p_contributed_at date,
  p_monthly_rate   numeric default null,
  p_anchor_day     integer default null,
  p_grace_months   integer default 0,
  p_method         text    default 'transferencia',
  p_source_bank    text    default null,
  p_operation_code text    default null,
  p_voucher_path   text    default null,
  p_voucher_hash   text    default null,
  p_notes          text    default null,
  p_dry_run        boolean default false)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line      public.investment_lines%rowtype;
  v_rate      numeric;
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

  v_rate := coalesce(p_monthly_rate, v_line.default_monthly_rate);
  if v_rate < 0 or v_rate > 1 then raise exception 'La tasa mensual debe estar entre 0 %% y 100 %%'; end if;
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
    'monthly_interest_cents', round(p_amount_cents * v_rate)::bigint,
    'monthly_rate', v_rate,
    'anchor_day', v_anchor,
    'first_period_start', v_first.period_start,
    'first_due_date', v_first.due_date,
    'delivered_before_cents', v_delivered,
    'delivered_after_cents', v_delivered + p_amount_cents,
    'committed_cents', v_line.committed_amount_cents);

  if coalesce(p_dry_run, false) then
    return jsonb_build_object('dry_run', true, 'warnings', v_warnings, 'preview', v_preview);
  end if;

  insert into public.contributions (
    line_id, amount_cents, contributed_at, anchor_day, monthly_rate, grace_months, method,
    source_bank, operation_code, voucher_path, voucher_hash, notes, created_by)
  values (
    p_line_id, p_amount_cents, p_contributed_at, v_anchor, v_rate, v_grace, p_method,
    nullif(btrim(p_source_bank), ''), nullif(btrim(p_operation_code), ''),
    nullif(p_voucher_path, ''), nullif(p_voucher_hash, ''), nullif(btrim(p_notes), ''), p_actor)
  returning id into v_id;

  perform public._inv_ensure_schedules(p_line_id);

  return jsonb_build_object('dry_run', false, 'contribution_id', v_id, 'warnings', v_warnings, 'preview', v_preview);
end;
$$;

-- ==================================================================== pagos y devoluciones
create or replace function public._inv_register_payment(
  p_actor          uuid,
  p_line_id        uuid,
  p_amount_cents   bigint,
  p_paid_at        timestamptz,
  p_method         text,
  p_kind           text    default 'interes',
  p_allocations    jsonb   default null,
  p_source_bank    text    default null,
  p_operation_code text    default null,
  p_voucher_path   text    default null,
  p_voucher_hash   text    default null,
  p_notes          text    default null,
  p_ocr_payload    jsonb   default null,
  p_ocr_confidence numeric default null,
  p_dry_run        boolean default false)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line      public.investment_lines%rowtype;
  v_paid_date date;
  v_plan      jsonb;
  v_warnings  jsonb;
  v_credit    bigint;
  v_item      jsonb;
  v_amt       bigint;
  v_pid       uuid;
  v_contribs  uuid[] := '{}';
  v_cid       uuid;
begin
  perform public._inv_set_actor(p_actor);
  if public._inv_line_role(p_line_id, p_actor) is null then
    raise exception 'No tienes acceso a esta línea' using errcode = '42501';
  end if;
  select * into v_line from public.investment_lines where id = p_line_id for update;
  if v_line.status = 'cerrada' then raise exception 'La línea está cerrada'; end if;

  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_paid_at is null then raise exception 'Indica la fecha del pago'; end if;
  if p_method = 'reinversion' then raise exception 'La reinversión se registra desde la cuota'; end if;
  if p_method not in ('yape','plin','transferencia','efectivo','otro') then raise exception 'Método no válido'; end if;
  if coalesce(p_kind, 'interes') not in ('interes','capital','mixto') then raise exception 'Tipo de pago no válido'; end if;

  v_paid_date := (p_paid_at at time zone 'America/Lima')::date;
  if v_paid_date > public.inv_today() then raise exception 'La fecha del pago no puede ser futura'; end if;

  perform public._inv_ensure_schedules(p_line_id);

  v_plan := public._inv_plan_allocations(p_line_id, p_amount_cents, coalesce(p_kind, 'interes'), v_paid_date, p_allocations);
  v_warnings := public._inv_duplicate_warnings(p_line_id, p_method, p_operation_code, p_voucher_hash);
  select coalesce(sum((e ->> 'amount_cents')::bigint), 0) into v_credit
    from jsonb_array_elements(v_plan) e where e ->> 'target_type' = 'credit';
  if v_credit > 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'saldo_a_favor',
      'message', public.inv_fmt(v_credit, v_line.currency) || ' quedan como saldo a favor para las próximas cuotas'));
  end if;

  if coalesce(p_dry_run, false) then
    return jsonb_build_object('dry_run', true, 'paid_date', v_paid_date, 'allocations', v_plan,
                              'credit_cents', v_credit, 'warnings', v_warnings);
  end if;

  insert into public.payments (
    line_id, amount_cents, paid_at, method, source_bank, operation_code, voucher_path, voucher_hash,
    ocr_payload, ocr_confidence, kind, notes, created_by)
  values (
    p_line_id, p_amount_cents, p_paid_at, p_method, nullif(btrim(p_source_bank), ''),
    nullif(btrim(p_operation_code), ''), nullif(p_voucher_path, ''), nullif(p_voucher_hash, ''),
    p_ocr_payload, p_ocr_confidence, coalesce(p_kind, 'interes'), nullif(btrim(p_notes), ''), p_actor)
  returning id into v_pid;

  for v_item in select value from jsonb_array_elements(v_plan) loop
    v_amt := (v_item ->> 'amount_cents')::bigint;

    insert into public.payment_allocations
      (payment_id, line_id, target_type, schedule_id, contribution_id, amount_cents, effective_date)
    values (
      v_pid, p_line_id, v_item ->> 'target_type',
      case when v_item ->> 'target_type' = 'schedule' then (v_item ->> 'schedule_id')::uuid end,
      case when v_item ->> 'target_type' in ('schedule','capital') then (v_item ->> 'contribution_id')::uuid end,
      v_amt, v_paid_date);

    if v_item ->> 'target_type' = 'schedule' then
      update public.interest_schedules
         set amount_paid_cents = amount_paid_cents + v_amt,
             paid_at = case when amount_paid_cents + v_amt + amount_waived_cents >= amount_due_cents
                            then v_paid_date else paid_at end
       where id = (v_item ->> 'schedule_id')::uuid;
    elsif v_item ->> 'target_type' = 'capital' then
      v_contribs := array_append(v_contribs, (v_item ->> 'contribution_id')::uuid);
    else
      insert into public.credit_balance_movements (line_id, amount_cents, kind, payment_id)
      values (p_line_id, v_amt, 'excedente', v_pid);
    end if;
  end loop;

  foreach v_cid in array v_contribs loop
    perform public._inv_recompute_contribution(v_cid);
  end loop;
  perform public._inv_refresh_statuses(p_line_id);

  return jsonb_build_object('dry_run', false, 'payment_id', v_pid, 'paid_date', v_paid_date,
                            'allocations', v_plan, 'credit_cents', v_credit, 'warnings', v_warnings);
end;
$$;

-- ==================================================================== cambios de tasa
-- Por aporte (p_contribution_id + p_from_period) o por línea (p_line_id + p_effective_date:
-- aplica a cada aporte activo desde su primer periodo que empiece en esa fecha o después,
-- y pasa a ser la tasa por defecto de los aportes nuevos). Nunca toca cuotas con pagos.
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
     where line_id = v_line and status = 'activo'
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

-- ==================================================================== anulaciones
-- Fase 1: anula movimientos propios aún no confirmados por la contraparte.
-- (Anular algo confirmado requiere el flujo bilateral de la fase 2.)
create or replace function public._inv_void_movement(p_actor uuid, p_type text, p_id uuid, p_reason text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_line    uuid;
  v_by      uuid;
  v_recon   text;
  v_status  text;
  r         record;
  v_credit  bigint;
  v_cid     uuid;
  v_contribs uuid[] := '{}';
begin
  perform public._inv_set_actor(p_actor);
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Indica el motivo de la anulación'; end if;

  if p_type = 'contribution' then
    select line_id, created_by, recon_status, status into v_line, v_by, v_recon, v_status
      from public.contributions where id = p_id;
  elsif p_type = 'payment' then
    select line_id, created_by, recon_status, status into v_line, v_by, v_recon, v_status
      from public.payments where id = p_id;
  else
    raise exception 'Tipo de movimiento no válido';
  end if;
  if v_line is null then raise exception 'Movimiento no encontrado' using errcode = 'P0002'; end if;
  if public._inv_line_role(v_line, p_actor) is null then raise exception 'No tienes acceso a esta línea' using errcode = '42501'; end if;
  if v_by <> p_actor then raise exception 'Solo quien registró el movimiento puede anularlo' using errcode = '42501'; end if;
  if v_status = 'anulado' then return; end if;
  if v_recon = 'confirmado' then
    raise exception 'El movimiento ya fue confirmado por la contraparte: su anulación debe confirmarse (fase 2)';
  end if;

  perform 1 from public.investment_lines where id = v_line for update;

  if p_type = 'contribution' then
    if exists (select 1 from public.payment_allocations a
                where a.contribution_id = p_id and a.voided_at is null) then
      raise exception 'El aporte tiene pagos o devoluciones registrados: anúlalos primero';
    end if;
    -- El saldo a favor aplicado a sus cuotas vuelve al saldo de la línea
    for r in
      select m.id, m.amount_cents, m.schedule_id
        from public.credit_balance_movements m
        join public.interest_schedules s on s.id = m.schedule_id
       where s.contribution_id = p_id and m.kind = 'aplicacion' and m.voided_at is null
    loop
      update public.credit_balance_movements set voided_at = now() where id = r.id;
      update public.interest_schedules
         set amount_paid_cents = amount_paid_cents + r.amount_cents, paid_at = null
       where id = r.schedule_id;
    end loop;
    update public.interest_schedules set status = 'anulada' where contribution_id = p_id and status <> 'anulada';
    update public.contributions
       set status = 'anulado', recon_status = 'anulado', void_reason = btrim(p_reason),
           voided_at = now(), voided_by = p_actor
     where id = p_id;

  else
    -- Revertir imputaciones del pago
    for r in
      select * from public.payment_allocations where payment_id = p_id and voided_at is null
    loop
      update public.payment_allocations set voided_at = now() where id = r.id;
      if r.target_type = 'schedule' then
        update public.interest_schedules
           set amount_paid_cents = amount_paid_cents - r.amount_cents,
               paid_at = case when amount_paid_cents - r.amount_cents + amount_waived_cents >= amount_due_cents
                              then paid_at else null end
         where id = r.schedule_id;
      elsif r.target_type = 'capital' then
        v_contribs := array_append(v_contribs, r.contribution_id);
      end if;
    end loop;
    update public.credit_balance_movements set voided_at = now()
     where payment_id = p_id and voided_at is null;

    -- Si el saldo a favor queda negativo, se deshacen las últimas aplicaciones
    v_credit := public._inv_credit_balance(v_line);
    for r in
      select m.id, m.amount_cents, m.schedule_id
        from public.credit_balance_movements m
       where m.line_id = v_line and m.kind = 'aplicacion' and m.voided_at is null
       order by m.created_at desc, m.id desc
    loop
      exit when v_credit >= 0;
      update public.credit_balance_movements set voided_at = now() where id = r.id;
      update public.interest_schedules
         set amount_paid_cents = amount_paid_cents + r.amount_cents, paid_at = null
       where id = r.schedule_id;
      v_credit := v_credit - r.amount_cents;
      -- si se devolvió de más, la diferencia vuelve como aplicación parcial
      if v_credit > 0 then
        insert into public.credit_balance_movements (line_id, amount_cents, kind, schedule_id)
        values (v_line, -v_credit, 'aplicacion', r.schedule_id);
        update public.interest_schedules
           set amount_paid_cents = amount_paid_cents + v_credit
         where id = r.schedule_id;
        v_credit := 0;
      end if;
    end loop;

    update public.payments
       set status = 'anulado', recon_status = 'anulado', void_reason = btrim(p_reason),
           voided_at = now(), voided_by = p_actor
     where id = p_id;

    foreach v_cid in array v_contribs loop
      perform public._inv_recompute_contribution(v_cid);
    end loop;
  end if;

  perform public._inv_refresh_statuses(v_line);
  perform public._inv_ensure_schedules(v_line);
end;
$$;

-- ==================================================================== lecturas
create or replace function public._inv_line_summary(p_line_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_line        public.investment_lines%rowtype;
  v_today       date := public.inv_today();
  v_month_start date := date_trunc('month', public.inv_today())::date;
  v_month_end   date := (date_trunc('month', public.inv_today()) + interval '1 month - 1 day')::date;
  v_result      jsonb;
begin
  select * into v_line from public.investment_lines where id = p_line_id;
  if not found then raise exception 'Línea de inversión no encontrada' using errcode = 'P0002'; end if;

  with
  contribs as (
    select c.*, public.inv_capital_at(c.id, 'infinity'::date) as capital_now
      from public.contributions c
     where c.line_id = p_line_id and c.status <> 'anulado'
  ),
  scheds as (
    select s.*, greatest(s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents, 0) as outstanding
      from public.interest_schedules s
     where s.line_id = p_line_id and s.status <> 'anulada'
  ),
  pend as (
    select * from scheds where status in ('programada','parcial') and outstanding > 0
  ),
  next_due as (
    select due_date, sum(outstanding) as amount, count(*) as n
      from pend where due_date >= v_today
     group by due_date order by due_date limit 1
  )
  select jsonb_build_object(
    'line_id', v_line.id,
    'manager_display_name', v_line.manager_display_name,
    'manager_phone', v_line.manager_phone,
    'manager_linked', v_line.manager_user_id is not null,
    'currency', v_line.currency,
    'status', v_line.status,
    'default_monthly_rate', v_line.default_monthly_rate,
    'interest_on_return_mode', v_line.interest_on_return_mode,
    'due_soon_days', v_line.due_soon_days,
    'payment_grace_days', v_line.payment_grace_days,
    'today', v_today,
    'committed_cents', v_line.committed_amount_cents,
    'delivered_cents', (select coalesce(sum(amount_cents), 0) from contribs),
    'to_deliver_cents', greatest(v_line.committed_amount_cents - (select coalesce(sum(amount_cents), 0) from contribs), 0),
    'capital_outstanding_cents', (select coalesce(sum(capital_now), 0) from contribs where status = 'activo'),
    'capital_returned_cents', (select coalesce(sum(amount_cents - capital_now), 0) from contribs),
    'contributions_count', (select count(*) from contribs),
    'credit_balance_cents', public._inv_credit_balance(p_line_id),
    'monthly_interest_expected_cents',
      (select coalesce(sum(amount_due_cents), 0) from scheds where due_date between v_month_start and v_month_end),
    'month_collected_cents',
      (select coalesce(sum(amount_paid_cents), 0) from scheds where due_date between v_month_start and v_month_end),
    'month_pending_cents',
      (select coalesce(sum(outstanding), 0) from pend where due_date between v_month_start and v_month_end),
    'overdue_cents',
      (select coalesce(sum(outstanding), 0) from pend where v_today > due_date + v_line.payment_grace_days),
    'overdue_count',
      (select count(*) from pend where v_today > due_date + v_line.payment_grace_days),
    'due_soon_count',
      (select count(*) from pend where v_today <= due_date + v_line.payment_grace_days
                                   and due_date - v_today <= v_line.due_soon_days),
    'pending_total_cents', (select coalesce(sum(outstanding), 0) from pend where due_date <= v_today + v_line.payment_grace_days),
    'interest_collected_total_cents', (select coalesce(sum(amount_paid_cents), 0) from scheds),
    'next_due', (select jsonb_build_object('due_date', due_date, 'amount_cents', amount, 'count', n) from next_due),
    'health', case
                when exists (select 1 from pend where v_today > due_date + v_line.payment_grace_days) then 'vencido'
                when exists (select 1 from pend where due_date - v_today <= v_line.due_soon_days) then 'por_vencer'
                else 'al_dia'
              end,
    'pending_recon_count', (
       (select count(*) from public.contributions c where c.line_id = p_line_id
           and c.recon_status = 'pendiente_contraparte' and c.status <> 'anulado'
           and c.created_by <> coalesce(public.inv_current_actor(), '00000000-0000-0000-0000-000000000000'::uuid))
     + (select count(*) from public.payments p where p.line_id = p_line_id
           and p.recon_status = 'pendiente_contraparte' and p.status <> 'anulado'
           and p.created_by <> coalesce(public.inv_current_actor(), '00000000-0000-0000-0000-000000000000'::uuid)))
  ) into v_result;

  return v_result;
end;
$$;

-- Próximos vencimientos (y vencidos) de las líneas del actor
create or replace function public._inv_upcoming_dues(p_actor uuid, p_days integer default 7)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'schedule_id', s.id, 'line_id', s.line_id, 'contribution_id', s.contribution_id,
           'manager_display_name', l.manager_display_name, 'currency', l.currency,
           'period_number', s.period_number, 'due_date', s.due_date,
           'outstanding_cents', s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents,
           'status', s.status,
           'overdue', public.inv_today() > s.due_date + l.payment_grace_days,
           'role', case when l.investor_user_id = p_actor then 'investor' else 'manager' end)
         order by s.due_date, l.manager_display_name), '[]'::jsonb)
    from public.interest_schedules s
    join public.investment_lines l on l.id = s.line_id
   where (l.investor_user_id = p_actor or l.manager_user_id = p_actor)
     and l.status <> 'cerrada'
     and s.status in ('programada','parcial')
     and s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents > 0
     and s.due_date <= public.inv_today() + greatest(coalesce(p_days, 7), 0)
$$;

-- Panel del inversionista: genera cuotas pendientes y devuelve KPIs + resumen por línea
create or replace function public._inv_overview(p_actor uuid, p_include_closed boolean default false)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  l       record;
  v_lines jsonb := '[]'::jsonb;
  v_sum   jsonb;
  v_kpis  jsonb;
begin
  perform public._inv_set_actor(p_actor);
  for l in
    select id, investor_user_id from public.investment_lines
     where (investor_user_id = p_actor or manager_user_id = p_actor)
       and (coalesce(p_include_closed, false) or status <> 'cerrada')
     order by created_at
  loop
    perform public._inv_ensure_schedules(l.id);
    v_sum := public._inv_line_summary(l.id)
             || jsonb_build_object('role', case when l.investor_user_id = p_actor then 'investor' else 'manager' end);
    v_lines := v_lines || jsonb_build_array(v_sum);
  end loop;

  select coalesce(jsonb_object_agg(currency, k), '{}'::jsonb) into v_kpis
    from (
      select x ->> 'currency' as currency,
             jsonb_build_object(
               'capital_outstanding_cents',       sum((x ->> 'capital_outstanding_cents')::bigint),
               'monthly_interest_expected_cents', sum((x ->> 'monthly_interest_expected_cents')::bigint),
               'month_collected_cents',           sum((x ->> 'month_collected_cents')::bigint),
               'month_pending_cents',             sum((x ->> 'month_pending_cents')::bigint),
               'overdue_cents',                   sum((x ->> 'overdue_cents')::bigint),
               'interest_collected_total_cents',  sum((x ->> 'interest_collected_total_cents')::bigint),
               'committed_cents',                 sum((x ->> 'committed_cents')::bigint),
               'delivered_cents',                 sum((x ->> 'delivered_cents')::bigint),
               'lines_count',                     count(*)) as k
        from jsonb_array_elements(v_lines) x
       where x ->> 'role' = 'investor'
       group by x ->> 'currency'
    ) t;

  return jsonb_build_object('today', public.inv_today(), 'kpis', v_kpis, 'lines', v_lines);
end;
$$;

-- ==================================================================== wrappers públicos (app)
create or replace function public._inv_require_uid()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  return v;
end;
$$;

create or replace function public.create_investment_line(
  p_manager_display_name    text,
  p_manager_phone           text    default null,
  p_currency                text    default 'PEN',
  p_committed_amount_cents  bigint  default 0,
  p_default_monthly_rate    numeric default 0.10,
  p_interest_on_return_mode text    default 'periodo_completo',
  p_due_soon_days           integer default 3,
  p_payment_grace_days      integer default 0,
  p_notes                   text    default null)
returns uuid
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_create_line(public._inv_require_uid(), p_manager_display_name, p_manager_phone, p_currency,
    p_committed_amount_cents, p_default_monthly_rate, p_interest_on_return_mode, p_due_soon_days,
    p_payment_grace_days, p_notes)
$$;

create or replace function public.update_investment_line(p_line_id uuid, p_patch jsonb)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$ select public._inv_update_line(public._inv_require_uid(), p_line_id, p_patch) $$;

create or replace function public.close_investment_line(p_line_id uuid, p_reason text default null)
returns void
language sql volatile security definer
set search_path = ''
as $$ select public._inv_close_line(public._inv_require_uid(), p_line_id, p_reason) $$;

create or replace function public.register_contribution(
  p_line_id        uuid,
  p_amount_cents   bigint,
  p_contributed_at date,
  p_monthly_rate   numeric default null,
  p_anchor_day     integer default null,
  p_grace_months   integer default 0,
  p_method         text    default 'transferencia',
  p_source_bank    text    default null,
  p_operation_code text    default null,
  p_voucher_path   text    default null,
  p_voucher_hash   text    default null,
  p_notes          text    default null,
  p_dry_run        boolean default false)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_register_contribution(public._inv_require_uid(), p_line_id, p_amount_cents, p_contributed_at,
    p_monthly_rate, p_anchor_day, p_grace_months, p_method, p_source_bank, p_operation_code, p_voucher_path,
    p_voucher_hash, p_notes, p_dry_run)
$$;

create or replace function public.register_payment_with_allocations(
  p_line_id        uuid,
  p_amount_cents   bigint,
  p_paid_at        timestamptz,
  p_method         text,
  p_kind           text    default 'interes',
  p_allocations    jsonb   default null,
  p_source_bank    text    default null,
  p_operation_code text    default null,
  p_voucher_path   text    default null,
  p_voucher_hash   text    default null,
  p_notes          text    default null,
  p_dry_run        boolean default false)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_register_payment(public._inv_require_uid(), p_line_id, p_amount_cents, p_paid_at, p_method,
    p_kind, p_allocations, p_source_bank, p_operation_code, p_voucher_path, p_voucher_hash, p_notes,
    null, null, p_dry_run)
$$;

-- Devolución de capital = pago kind 'capital' (FIFO o aportes elegidos en p_allocations)
create or replace function public.register_capital_return(
  p_line_id        uuid,
  p_amount_cents   bigint,
  p_paid_at        timestamptz,
  p_method         text,
  p_allocations    jsonb   default null,
  p_source_bank    text    default null,
  p_operation_code text    default null,
  p_voucher_path   text    default null,
  p_voucher_hash   text    default null,
  p_notes          text    default null,
  p_dry_run        boolean default false)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_register_payment(public._inv_require_uid(), p_line_id, p_amount_cents, p_paid_at, p_method,
    'capital', p_allocations, p_source_bank, p_operation_code, p_voucher_path, p_voucher_hash, p_notes,
    null, null, p_dry_run)
$$;

create or replace function public.change_rate(
  p_new_rate        numeric,
  p_reason          text,
  p_contribution_id uuid    default null,
  p_from_period     integer default null,
  p_line_id         uuid    default null,
  p_effective_date  date    default null)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$
  select public._inv_change_rate(public._inv_require_uid(), p_new_rate, p_reason, p_contribution_id,
    p_from_period, p_line_id, p_effective_date)
$$;

create or replace function public.void_movement(p_type text, p_id uuid, p_reason text)
returns void
language sql volatile security definer
set search_path = ''
as $$ select public._inv_void_movement(public._inv_require_uid(), p_type, p_id, p_reason) $$;

create or replace function public.ensure_schedules(p_line_id uuid)
returns integer
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if public._inv_line_role(p_line_id, public._inv_require_uid()) is null then
    raise exception 'No tienes acceso a esta línea' using errcode = '42501';
  end if;
  return public._inv_ensure_schedules(p_line_id);
end;
$$;

create or replace function public.line_summary(p_line_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_uid uuid := public._inv_require_uid();
begin
  if public._inv_line_role(p_line_id, v_uid) is null then
    raise exception 'No tienes acceso a esta línea' using errcode = '42501';
  end if;
  perform public._inv_ensure_schedules(p_line_id);
  return public._inv_line_summary(p_line_id)
         || jsonb_build_object('role', public._inv_line_role(p_line_id, v_uid));
end;
$$;

create or replace function public.upcoming_dues(p_days integer default 7)
returns jsonb
language sql stable security definer
set search_path = ''
as $$ select public._inv_upcoming_dues(public._inv_require_uid(), p_days) $$;

create or replace function public.investments_overview(p_include_closed boolean default false)
returns jsonb
language sql volatile security definer
set search_path = ''
as $$ select public._inv_overview(public._inv_require_uid(), p_include_closed) $$;

-- ==================================================================== permisos
-- Internas (_inv_*): solo service_role. Wrappers: solo usuarios con sesión.
-- Helpers inv_* de cálculo: sin acceso anónimo.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like '\_inv\_%' or p.proname like 'inv\_%'
            or p.proname in ('create_investment_line','update_investment_line','close_investment_line',
                             'register_contribution','register_payment_with_allocations','register_capital_return',
                             'change_rate','void_movement','ensure_schedules','line_summary','upcoming_dues',
                             'investments_overview'))
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like '\_inv\_%' or f.proname in ('inv_audit_trigger','inv_block_delete') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
