-- =====================================================================================
-- 012_investments_engine.sql — Motor de intereses (única implementación: app y bot)
-- =====================================================================================
-- Reglas: interés simple mensual; cada aporte vence en su aniversario con día ancla
-- (fin de mes sin perder el ancla); monto = round_half_up(capital × tasa) en céntimos;
-- generación incremental e idempotente (vencidas hasta hoy + la próxima); fecha de
-- negocio en America/Lima.
-- Funciones `inv_*`: helpers puros/lectura. Funciones `_inv_*`: internas (sin permisos
-- para anon/authenticated; solo las llaman otras funciones o la service key).
-- Idempotente.
-- =====================================================================================

-- ------------------------------------------------------------------ fechas
-- Hoy en Lima. `finwat.today` permite fijar la fecha en los tests (set_config local).
create or replace function public.inv_today()
returns date
language sql stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('finwat.today', true), '')::date,
    (now() at time zone 'America/Lima')::date
  )
$$;

-- Suma meses respetando el día ancla: 31-ene +1 → 28-feb, +2 → 31-mar.
create or replace function public.inv_add_months_anchored(p_base date, p_months integer, p_anchor integer)
returns date
language sql immutable
set search_path = ''
as $$
  select make_date(
           extract(year from m)::int,
           extract(month from m)::int,
           least(p_anchor, extract(day from (m + interval '1 month' - interval '1 day'))::int))
  from (select (date_trunc('month', p_base) + make_interval(months => p_months))::date as m) s
$$;

-- Periodo k de un aporte. Con gracia g: el periodo 1 va de D+g meses a D+(g+1) meses.
create or replace function public.inv_period_bounds(
  p_contributed_at date, p_anchor integer, p_grace integer, p_period integer,
  out period_start date, out due_date date)
language sql immutable
set search_path = ''
as $$
  select case when p_grace + p_period - 1 = 0 then p_contributed_at
              else public.inv_add_months_anchored(p_contributed_at, p_grace + p_period - 1, p_anchor) end,
         public.inv_add_months_anchored(p_contributed_at, p_grace + p_period, p_anchor)
$$;

-- Formato de montos para mensajes de error/advertencia
create or replace function public.inv_fmt(p_cents bigint, p_currency text default 'PEN')
returns text
language sql immutable
set search_path = ''
as $$
  select case when p_currency = 'USD' then 'US$ ' else 'S/ ' end
         || to_char(p_cents / 100.0, 'FM999,999,999,990.00')
$$;

-- ------------------------------------------------------------------ capital y tasa
-- Capital vigente de un aporte al final del día p_date (devoluciones con fecha <= p_date).
create or replace function public.inv_capital_at(p_contribution uuid, p_date date)
returns bigint
language sql stable
set search_path = ''
as $$
  select c.amount_cents - coalesce((
           select sum(a.amount_cents)
           from public.payment_allocations a
           where a.contribution_id = c.id
             and a.target_type = 'capital'
             and a.voided_at is null
             and a.effective_date <= p_date), 0)
  from public.contributions c
  where c.id = p_contribution
$$;

-- Tasa vigente para el periodo k: el último cambio con from_period <= k, o la del aporte.
create or replace function public.inv_rate_for_period(p_contribution uuid, p_period integer)
returns numeric
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select r.new_rate
       from public.rate_changes r
      where r.contribution_id = p_contribution
        and r.voided_at is null
        and r.from_period <= p_period
      order by r.from_period desc, r.created_at desc
      limit 1),
    (select c.monthly_rate from public.contributions c where c.id = p_contribution))
$$;

-- Interés del periodo [p_start, p_end).
--   periodo_completo: capital al inicio × tasa (una devolución reduce desde el periodo siguiente)
--   prorrateo_diario: Σ(capital_día) / días_del_periodo × tasa
create or replace function public.inv_period_interest(
  p_contribution uuid, p_start date, p_end date, p_rate numeric, p_mode text)
returns bigint
language plpgsql stable
set search_path = ''
as $$
declare
  v_sum numeric;
begin
  if p_mode = 'prorrateo_diario' then
    select sum(public.inv_capital_at(p_contribution, d::date))
      into v_sum
      from generate_series(p_start, p_end - 1, interval '1 day') d;
    return round(coalesce(v_sum, 0) * p_rate / (p_end - p_start));
  end if;
  return round(public.inv_capital_at(p_contribution, p_start) * p_rate);
end;
$$;

-- ------------------------------------------------------------------ internas
create or replace function public._inv_set_actor(p_actor uuid)
returns void
language sql volatile
set search_path = ''
as $$
  select set_config('finwat.actor', coalesce(p_actor::text, ''), true);
$$;

-- 'investor' | 'manager' | null
create or replace function public._inv_line_role(p_line uuid, p_actor uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
           when l.investor_user_id = p_actor then 'investor'
           when l.manager_user_id  = p_actor then 'manager'
         end
  from public.investment_lines l
  where l.id = p_line
$$;

create or replace function public._inv_credit_balance(p_line uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(m.amount_cents), 0)::bigint
  from public.credit_balance_movements m
  where m.line_id = p_line and m.voided_at is null
$$;

-- Aplica saldo a favor a una cuota recién generada.
create or replace function public._inv_apply_credit(p_line uuid, p_schedule uuid)
returns bigint
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_credit      bigint := public._inv_credit_balance(p_line);
  v_outstanding bigint;
  v_apply       bigint;
begin
  if v_credit <= 0 then return 0; end if;

  select s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents
    into v_outstanding
    from public.interest_schedules s
   where s.id = p_schedule and s.status in ('programada','parcial');
  if v_outstanding is null or v_outstanding <= 0 then return 0; end if;

  v_apply := least(v_credit, v_outstanding);
  insert into public.credit_balance_movements (line_id, amount_cents, kind, schedule_id)
  values (p_line, -v_apply, 'aplicacion', p_schedule);

  update public.interest_schedules
     set amount_paid_cents = amount_paid_cents + v_apply,
         paid_at = case when amount_paid_cents + v_apply + amount_waived_cents >= amount_due_cents
                        then public.inv_today() else paid_at end
   where id = p_schedule;
  return v_apply;
end;
$$;

-- Recalcula base, tasa y monto de las cuotas SIN pagos de un aporte activo
-- (tras una devolución de capital o un cambio de tasa). Lo pagado nunca cambia.
create or replace function public._inv_recompute_contribution(p_contribution uuid)
returns integer
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_mode   text;
  v_status text;
  s        record;
  v_rate   numeric;
  v_base   bigint;
  v_amount bigint;
  v_count  integer := 0;
begin
  select l.interest_on_return_mode, c.status
    into v_mode, v_status
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
    v_rate := public.inv_rate_for_period(p_contribution, s.period_number);
    v_base := public.inv_capital_at(p_contribution, s.period_start);
    v_amount := public.inv_period_interest(p_contribution, s.period_start, s.due_date, v_rate, v_mode);

    if v_amount <= 0 and v_base <= 0 then
      -- sin capital en todo el periodo: la cuota deja de existir (se anula, no se borra)
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

-- Recalcula estados guardados de cuotas, aportes y línea.
create or replace function public._inv_refresh_statuses(p_line uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  update public.interest_schedules s
     set status = x.new_status
    from (
      select id,
             case
               when amount_due_cents - amount_paid_cents - amount_waived_cents <= 0 then
                 case when amount_paid_cents = 0 and amount_waived_cents > 0 then 'condonada' else 'pagada' end
               when amount_paid_cents + amount_waived_cents > 0 then 'parcial'
               else 'programada'
             end as new_status
        from public.interest_schedules
       where line_id = p_line and status <> 'anulada'
    ) x
   where s.id = x.id and s.status <> x.new_status;

  -- Aporte liquidado: sin capital vigente y sin cuotas pendientes (y viceversa al anular pagos)
  update public.contributions c
     set status = x.new_status
    from (
      select c2.id,
             case
               when public.inv_capital_at(c2.id, 'infinity'::date) <= 0
                and not exists (select 1 from public.interest_schedules s
                                 where s.contribution_id = c2.id and s.status in ('programada','parcial'))
               then 'liquidado' else 'activo'
             end as new_status
        from public.contributions c2
       where c2.line_id = p_line and c2.status in ('activo','liquidado')
    ) x
   where c.id = x.id and c.status <> x.new_status;

  -- Línea liquidada: tiene aportes y ninguno activo. 'cerrada' es manual y no se toca.
  update public.investment_lines l
     set status = x.new_status
    from (
      select case
               when exists (select 1 from public.contributions c where c.line_id = p_line and c.status = 'liquidado')
                and not exists (select 1 from public.contributions c where c.line_id = p_line and c.status = 'activo')
               then 'liquidada' else 'activa'
             end as new_status
    ) x
   where l.id = p_line and l.status <> 'cerrada' and l.status <> x.new_status;
end;
$$;

-- Genera las cuotas que falten: todas las vencidas hasta hoy + la próxima de cada aporte.
-- Idempotente (UNIQUE(contribution_id, period_number)). Aplica saldo a favor a las nuevas.
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
     where line_id = p_line and status = 'activo'
     order by contributed_at, created_at
  loop
    loop
      select max(period_number), max(due_date)
        into v_k, v_last_due
        from public.interest_schedules
       where contribution_id = c.id;
      exit when v_last_due is not null and v_last_due > v_today;

      v_k := coalesce(v_k, 0) + 1;
      exit when v_k > 600;  -- 50 años: tope de seguridad

      select b.period_start, b.due_date into v_start, v_due
        from public.inv_period_bounds(c.contributed_at, c.anchor_day, c.grace_months, v_k) b;
      v_base := public.inv_capital_at(c.id, v_start);
      exit when v_base <= 0;  -- sin capital: no hay más cuotas

      v_rate := public.inv_rate_for_period(c.id, v_k);
      v_amount := public.inv_period_interest(c.id, v_start, v_due, v_rate, v_line.interest_on_return_mode);

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

-- Propuesta de imputación de un pago (no escribe nada).
-- Automática: (1) cuotas pendientes por fecha de vencimiento (vencidas primero),
-- (2) kind capital/mixto → capital FIFO, (3) resto → saldo a favor (kind capital: error).
-- Manual: p_manual = [{target_type, schedule_id|contribution_id, amount_cents}], debe sumar el monto.
create or replace function public._inv_plan_allocations(
  p_line uuid, p_amount bigint, p_kind text, p_paid_date date, p_manual jsonb default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_currency text;
  v_plan     jsonb := '[]'::jsonb;
  v_rem      bigint := p_amount;
  v_used     jsonb := '{}'::jsonb;
  v_item     jsonb;
  v_take     bigint;
  v_prev     bigint;
  r          record;
begin
  select currency into v_currency from public.investment_lines where id = p_line;

  -- ---------------------------------------------------------------- manual
  if p_manual is not null and jsonb_typeof(p_manual) = 'array' and jsonb_array_length(p_manual) > 0 then
    for v_item in select value from jsonb_array_elements(p_manual) loop
      v_take := (v_item ->> 'amount_cents')::bigint;
      if v_take is null or v_take <= 0 then
        raise exception 'Cada imputación debe tener un monto mayor a 0';
      end if;

      if v_item ->> 'target_type' = 'schedule' then
        select s.id, s.due_date, s.period_number, s.contribution_id,
               s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents as outstanding
          into r
          from public.interest_schedules s
         where s.id = (v_item ->> 'schedule_id')::uuid
           and s.line_id = p_line
           and s.status in ('programada','parcial');
        if not found then raise exception 'La cuota indicada no está pendiente en esta línea'; end if;
        v_prev := coalesce((v_used ->> r.id::text)::bigint, 0);
        if v_prev + v_take > r.outstanding then
          raise exception 'La imputación supera el saldo de la cuota del % (%)',
            to_char(r.due_date, 'DD/MM/YYYY'), public.inv_fmt(r.outstanding, v_currency);
        end if;
        v_used := v_used || jsonb_build_object(r.id::text, v_prev + v_take);
        v_plan := v_plan || jsonb_build_array(jsonb_build_object(
          'target_type', 'schedule', 'schedule_id', r.id, 'contribution_id', r.contribution_id,
          'due_date', r.due_date, 'period_number', r.period_number,
          'outstanding_before_cents', r.outstanding, 'amount_cents', v_take));

      elsif v_item ->> 'target_type' = 'capital' then
        select c.id, c.contributed_at, public.inv_capital_at(c.id, 'infinity'::date) as cap
          into r
          from public.contributions c
         where c.id = (v_item ->> 'contribution_id')::uuid
           and c.line_id = p_line
           and c.status = 'activo';
        if not found then raise exception 'El aporte indicado no está activo en esta línea'; end if;
        if r.contributed_at > p_paid_date then
          raise exception 'No se puede devolver capital antes de la fecha del aporte (%)', to_char(r.contributed_at, 'DD/MM/YYYY');
        end if;
        v_prev := coalesce((v_used ->> r.id::text)::bigint, 0);
        if v_prev + v_take > r.cap then
          raise exception 'La devolución supera el capital vigente del aporte (%)', public.inv_fmt(r.cap, v_currency);
        end if;
        v_used := v_used || jsonb_build_object(r.id::text, v_prev + v_take);
        v_plan := v_plan || jsonb_build_array(jsonb_build_object(
          'target_type', 'capital', 'contribution_id', r.id, 'contributed_at', r.contributed_at,
          'capital_before_cents', r.cap, 'amount_cents', v_take));

      elsif v_item ->> 'target_type' = 'credit' then
        v_plan := v_plan || jsonb_build_array(jsonb_build_object('target_type', 'credit', 'amount_cents', v_take));
      else
        raise exception 'Tipo de imputación no válido: %', v_item ->> 'target_type';
      end if;
      v_rem := v_rem - v_take;
    end loop;

    if v_rem <> 0 then
      raise exception 'Las imputaciones suman % y el pago es de %',
        public.inv_fmt(p_amount - v_rem, v_currency), public.inv_fmt(p_amount, v_currency);
    end if;
    return v_plan;
  end if;

  -- ---------------------------------------------------------------- automática
  if p_kind in ('interes','mixto') then
    for r in
      select s.id, s.due_date, s.period_number, s.contribution_id,
             s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents as outstanding
        from public.interest_schedules s
        join public.contributions c on c.id = s.contribution_id
       where s.line_id = p_line
         and s.status in ('programada','parcial')
         and c.status <> 'anulado'
         and s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents > 0
       order by s.due_date, c.contributed_at, c.created_at, s.period_number
    loop
      exit when v_rem <= 0;
      v_take := least(v_rem, r.outstanding);
      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'target_type', 'schedule', 'schedule_id', r.id, 'contribution_id', r.contribution_id,
        'due_date', r.due_date, 'period_number', r.period_number,
        'outstanding_before_cents', r.outstanding, 'amount_cents', v_take));
      v_rem := v_rem - v_take;
    end loop;
  end if;

  if v_rem > 0 and p_kind in ('capital','mixto') then
    for r in
      select c.id, c.contributed_at, public.inv_capital_at(c.id, 'infinity'::date) as cap
        from public.contributions c
       where c.line_id = p_line and c.status = 'activo' and c.contributed_at <= p_paid_date
       order by c.contributed_at, c.created_at
    loop
      exit when v_rem <= 0;
      continue when r.cap <= 0;
      v_take := least(v_rem, r.cap);
      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'target_type', 'capital', 'contribution_id', r.id, 'contributed_at', r.contributed_at,
        'capital_before_cents', r.cap, 'amount_cents', v_take));
      v_rem := v_rem - v_take;
    end loop;
    if v_rem > 0 then
      raise exception 'El monto supera el capital vigente de la línea en %', public.inv_fmt(v_rem, v_currency);
    end if;
  end if;

  if v_rem > 0 then
    v_plan := v_plan || jsonb_build_array(jsonb_build_object('target_type', 'credit', 'amount_cents', v_rem));
  end if;
  return v_plan;
end;
$$;

-- Advertencias de duplicado (no bloquean): número de operación + método, o hash del voucher.
create or replace function public._inv_duplicate_warnings(
  p_line uuid, p_method text, p_operation_code text, p_voucher_hash text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(w), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'code', 'operacion_duplicada',
             'message', 'Ya hay un movimiento con el número de operación ' || btrim(p_operation_code)
                        || ' (' || p_method || ') en esta línea') as w
     where nullif(btrim(p_operation_code), '') is not null
       and (exists (select 1 from public.payments p
                     where p.line_id = p_line and p.status = 'activo' and p.method = p_method
                       and lower(btrim(p.operation_code)) = lower(btrim(p_operation_code)))
         or exists (select 1 from public.contributions c
                     where c.line_id = p_line and c.status <> 'anulado' and c.method = p_method
                       and lower(btrim(c.operation_code)) = lower(btrim(p_operation_code))))
    union all
    select jsonb_build_object(
             'code', 'voucher_duplicado',
             'message', 'Este voucher ya se registró en otro movimiento de esta línea')
     where nullif(p_voucher_hash, '') is not null
       and (exists (select 1 from public.payments p
                     where p.line_id = p_line and p.status = 'activo' and p.voucher_hash = p_voucher_hash)
         or exists (select 1 from public.contributions c
                     where c.line_id = p_line and c.status <> 'anulado' and c.voucher_hash = p_voucher_hash))
  ) x
$$;
