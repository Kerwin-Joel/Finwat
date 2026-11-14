-- =====================================================================================
-- FASE 1 — Inversiones con gestores: migraciones 010 a 015 en UNA transacción
-- =====================================================================================
-- Pegar completo en Supabase → SQL Editor → Run (proyecto tcltpyhxxgmwlhvztuba).
-- Si algo falla, no se aplica nada (rollback automático). Es idempotente: se puede
-- volver a correr. Solo CREA objetos nuevos; no modifica tablas ni datos existentes.
-- Generado desde supabase/migrations/010..015 — no editar a mano.
-- =====================================================================================
begin;
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 010_investments_schema.sql
-- =====================================================================================
-- 010_investments_schema.sql â€” Inversiones con gestores: tablas
-- =====================================================================================
-- Aditiva: no toca ninguna tabla existente. Montos en bigint (cÃ©ntimos), tasas numeric(6,4).
-- Las tablas nacen con RLS activo y SIN permisos de escritura para anon/authenticated:
-- toda escritura va por las RPC de 013. Las policies de lectura estÃ¡n en 014.
-- Idempotente.
-- =====================================================================================

-- ------------------------------------------------------------------ lÃ­neas de inversiÃ³n
create table if not exists public.investment_lines (
  id                      uuid primary key default gen_random_uuid(),
  investor_user_id        uuid not null references auth.users(id),
  manager_user_id         uuid references auth.users(id),          -- null hasta que el gestor acepte (fase 2)
  manager_display_name    text not null check (length(btrim(manager_display_name)) between 1 and 80),
  manager_phone           text check (manager_phone ~ '^[0-9]{8,15}$'),
  currency                text not null default 'PEN' check (currency in ('PEN','USD')),
  committed_amount_cents  bigint not null default 0 check (committed_amount_cents >= 0),
  default_monthly_rate    numeric(6,4) not null default 0.1000 check (default_monthly_rate between 0 and 1),
  cutoff_mode             text not null default 'por_aporte' check (cutoff_mode in ('por_aporte','consolidado')),
  cutoff_day              smallint check (cutoff_day between 1 and 31),
  interest_on_return_mode text not null default 'periodo_completo'
                          check (interest_on_return_mode in ('periodo_completo','prorrateo_diario')),
  due_soon_days           smallint not null default 3 check (due_soon_days between 0 and 31),
  payment_grace_days      smallint not null default 0 check (payment_grace_days between 0 and 31),
  late_fee_monthly_rate   numeric(6,4) not null default 0 check (late_fee_monthly_rate = 0), -- existe pero desactivado
  reminder_settings       jsonb not null default '{}'::jsonb,
  status                  text not null default 'activa' check (status in ('activa','liquidada','cerrada')),
  notes                   text,
  closed_at               timestamptz,
  created_by              uuid not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint investment_lines_manager_not_investor
    check (manager_user_id is null or manager_user_id <> investor_user_id)
);
create index if not exists investment_lines_investor_idx on public.investment_lines (investor_user_id);
create index if not exists investment_lines_manager_idx  on public.investment_lines (manager_user_id);

-- ------------------------------------------------------------------ aportes de capital
create table if not exists public.contributions (
  id                uuid primary key default gen_random_uuid(),
  line_id           uuid not null references public.investment_lines(id),
  amount_cents      bigint not null check (amount_cents > 0),
  contributed_at    date not null,
  anchor_day        smallint not null check (anchor_day between 1 and 31),
  monthly_rate      numeric(6,4) not null check (monthly_rate between 0 and 1),
  grace_months      smallint not null default 0 check (grace_months between 0 and 24),
  method            text not null default 'transferencia'
                    check (method in ('yape','plin','transferencia','efectivo','reinversion','otro')),
  source_bank       text,
  operation_code    text,
  voucher_path      text,
  voucher_hash      text,
  recon_status      text not null default 'pendiente_contraparte'
                    check (recon_status in ('pendiente_contraparte','confirmado','observado','anulado')),
  status            text not null default 'activo' check (status in ('activo','liquidado','anulado')),
  void_reason       text,
  voided_at         timestamptz,
  voided_by         uuid,
  source_payment_id uuid,                                   -- reinversiÃ³n (fase 4)
  notes             text,
  created_by        uuid not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint contributions_void_has_reason
    check (status <> 'anulado' or (void_reason is not null and voided_at is not null))
);
create index if not exists contributions_line_idx on public.contributions (line_id, contributed_at);

-- ------------------------------------------------------------------ cuotas de interÃ©s
create table if not exists public.interest_schedules (
  id                  uuid primary key default gen_random_uuid(),
  contribution_id     uuid not null references public.contributions(id),
  line_id             uuid not null references public.investment_lines(id),
  period_number       integer not null check (period_number >= 1),
  period_start        date not null,
  due_date            date not null,
  base_capital_cents  bigint not null check (base_capital_cents >= 0),
  rate                numeric(6,4) not null check (rate between 0 and 1),
  amount_due_cents    bigint not null check (amount_due_cents >= 0),
  amount_paid_cents   bigint not null default 0 check (amount_paid_cents >= 0),
  amount_waived_cents bigint not null default 0 check (amount_waived_cents >= 0),
  -- por_vencer y vencida NO se guardan: se calculan al leer (interest_schedules_view)
  status              text not null default 'programada'
                      check (status in ('programada','parcial','pagada','condonada','anulada')),
  paid_at             date,                                 -- fecha en que quedÃ³ cubierta
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint interest_schedules_period_unique unique (contribution_id, period_number),
  constraint interest_schedules_dates check (due_date > period_start),
  constraint interest_schedules_not_overpaid
    check (amount_paid_cents + amount_waived_cents <= amount_due_cents)
);
create index if not exists interest_schedules_line_due_idx on public.interest_schedules (line_id, due_date);

-- ------------------------------------------------------------------ pagos del gestor
-- Las devoluciones de capital son pagos con kind 'capital' (o 'mixto').
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  line_id         uuid not null references public.investment_lines(id),
  amount_cents    bigint not null check (amount_cents > 0),
  paid_at         timestamptz not null,
  method          text not null check (method in ('yape','plin','transferencia','efectivo','reinversion','otro')),
  source_bank     text,
  operation_code  text,
  voucher_path    text,
  voucher_hash    text,
  ocr_payload     jsonb,
  ocr_confidence  numeric(4,3),
  kind            text not null default 'interes' check (kind in ('interes','capital','mixto')),
  recon_status    text not null default 'pendiente_contraparte'
                  check (recon_status in ('pendiente_contraparte','confirmado','observado','anulado')),
  status          text not null default 'activo' check (status in ('activo','anulado')),
  void_reason     text,
  voided_at       timestamptz,
  voided_by       uuid,
  notes           text,
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_void_has_reason
    check (status <> 'anulado' or (void_reason is not null and voided_at is not null))
);
create index if not exists payments_line_idx      on public.payments (line_id, paid_at desc);
create index if not exists payments_operation_idx on public.payments (line_id, operation_code) where operation_code is not null;
create index if not exists payments_voucher_idx   on public.payments (line_id, voucher_hash) where voucher_hash is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contributions_source_payment_fkey') then
    alter table public.contributions
      add constraint contributions_source_payment_fkey
      foreign key (source_payment_id) references public.payments(id);
  end if;
end $$;
create index if not exists contributions_source_payment_idx on public.contributions (source_payment_id);

-- ------------------------------------------------------------------ imputaciones
create table if not exists public.payment_allocations (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid not null references public.payments(id),
  line_id         uuid not null references public.investment_lines(id),
  target_type     text not null check (target_type in ('schedule','capital','credit')),
  schedule_id     uuid references public.interest_schedules(id),
  contribution_id uuid references public.contributions(id),
  amount_cents    bigint not null check (amount_cents > 0),
  effective_date  date not null,                            -- fecha del pago en Lima
  voided_at       timestamptz,
  created_at      timestamptz not null default now(),
  constraint payment_allocations_target check (
       (target_type = 'schedule' and schedule_id is not null)
    or (target_type = 'capital'  and contribution_id is not null and schedule_id is null)
    or (target_type = 'credit'   and schedule_id is null and contribution_id is null))
);
create index if not exists payment_allocations_payment_idx      on public.payment_allocations (payment_id);
create index if not exists payment_allocations_line_idx         on public.payment_allocations (line_id);
create index if not exists payment_allocations_schedule_idx     on public.payment_allocations (schedule_id);
create index if not exists payment_allocations_contribution_idx on public.payment_allocations (contribution_id);

-- ------------------------------------------------------------------ saldo a favor
-- + excedente de un pago / âˆ’ aplicaciÃ³n a una cuota generada despuÃ©s
create table if not exists public.credit_balance_movements (
  id           uuid primary key default gen_random_uuid(),
  line_id      uuid not null references public.investment_lines(id),
  amount_cents bigint not null check (amount_cents <> 0),
  kind         text not null check (kind in ('excedente','aplicacion')),
  payment_id   uuid references public.payments(id),
  schedule_id  uuid references public.interest_schedules(id),
  voided_at    timestamptz,
  created_at   timestamptz not null default now(),
  constraint credit_balance_movements_sign check (
       (kind = 'excedente'  and amount_cents > 0 and payment_id is not null)
    or (kind = 'aplicacion' and amount_cents < 0 and schedule_id is not null))
);
create index if not exists credit_balance_movements_line_idx     on public.credit_balance_movements (line_id);
create index if not exists credit_balance_movements_payment_idx  on public.credit_balance_movements (payment_id);
create index if not exists credit_balance_movements_schedule_idx on public.credit_balance_movements (schedule_id);

-- ------------------------------------------------------------------ cambios de tasa
create table if not exists public.rate_changes (
  id              uuid primary key default gen_random_uuid(),
  line_id         uuid not null references public.investment_lines(id),
  contribution_id uuid not null references public.contributions(id),
  from_period     integer not null check (from_period >= 1),
  old_rate        numeric(6,4) not null,
  new_rate        numeric(6,4) not null check (new_rate between 0 and 1),
  reason          text not null check (length(btrim(reason)) > 0),
  voided_at       timestamptz,
  created_by      uuid not null,
  created_at      timestamptz not null default now()
);
create index if not exists rate_changes_contribution_idx on public.rate_changes (contribution_id, from_period);
create index if not exists rate_changes_line_idx         on public.rate_changes (line_id);

-- ------------------------------------------------------------------ updated_at
do $$
declare t text;
begin
  foreach t in array array['investment_lines','contributions','interest_schedules','payments'] loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ RLS y permisos
do $$
declare t text;
begin
  foreach t in array array['investment_lines','contributions','interest_schedules','payments',
                           'payment_allocations','credit_balance_movements','rate_changes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 011_investments_audit.sql
-- =====================================================================================
-- 011_investments_audit.sql â€” AuditorÃ­a y "nada se borra"
-- =====================================================================================
-- audit_log guarda quiÃ©n, quÃ©, cuÃ¡ndo y el antes/despuÃ©s de cada cambio en las tablas
-- de inversiones. Un trigger impide DELETE/TRUNCATE: los registros se anulan.
-- El actor es auth.uid() (app) o el user_id que fija la RPC interna (bot con service key).
-- Idempotente.
-- =====================================================================================

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  uuid,
  line_id    uuid,
  action     text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor      uuid,
  old_data   jsonb,
  new_data   jsonb,
  changed_at timestamptz not null default now()
);
create index if not exists audit_log_line_idx   on public.audit_log (line_id, changed_at desc);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- Actor de la operaciÃ³n: sesiÃ³n de la app o el que fija una RPC interna
create or replace function public.inv_current_actor()
returns uuid
language sql stable
set search_path = ''
as $$
  select coalesce(auth.uid(), nullif(current_setting('finwat.actor', true), '')::uuid)
$$;

create or replace function public.inv_audit_trigger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old  jsonb;
  v_new  jsonb;
  v_id   uuid;
  v_line uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  -- Un UPDATE que solo toca updated_at no es un cambio
  if tg_op = 'UPDATE' and (v_new - 'updated_at') = (v_old - 'updated_at') then
    return new;
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
  v_line := case
              when tg_table_name = 'investment_lines' then v_id
              else coalesce(v_new ->> 'line_id', v_old ->> 'line_id')::uuid
            end;

  insert into public.audit_log (table_name, record_id, line_id, action, actor, old_data, new_data)
  values (tg_table_name, v_id, v_line, tg_op, public.inv_current_actor(), v_old, v_new);

  return coalesce(new, old);
end;
$$;

create or replace function public.inv_block_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'En inversiones no se borran registros (%): se anulan.', tg_table_name
    using errcode = 'P0001';
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['investment_lines','contributions','interest_schedules','payments',
                           'payment_allocations','credit_balance_movements','rate_changes'] loop
    execute format('drop trigger if exists inv_audit on public.%I', t);
    execute format(
      'create trigger inv_audit after insert or update or delete on public.%I
         for each row execute function public.inv_audit_trigger()', t);
  end loop;

  foreach t in array array['investment_lines','contributions','interest_schedules','payments',
                           'payment_allocations','credit_balance_movements','rate_changes','audit_log'] loop
    execute format('drop trigger if exists inv_no_delete on public.%I', t);
    execute format(
      'create trigger inv_no_delete before delete on public.%I
         for each row execute function public.inv_block_delete()', t);
    execute format('drop trigger if exists inv_no_truncate on public.%I', t);
    execute format(
      'create trigger inv_no_truncate before truncate on public.%I
         for each statement execute function public.inv_block_delete()', t);
  end loop;
end $$;

-- El historial tampoco se edita
drop trigger if exists inv_no_update on public.audit_log;
create trigger inv_no_update before update on public.audit_log
  for each row execute function public.inv_block_delete();

revoke execute on function public.inv_audit_trigger() from public, anon, authenticated;
revoke execute on function public.inv_block_delete()  from public, anon, authenticated;
revoke execute on function public.inv_current_actor() from public, anon;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 012_investments_engine.sql
-- =====================================================================================
-- 012_investments_engine.sql â€” Motor de intereses (Ãºnica implementaciÃ³n: app y bot)
-- =====================================================================================
-- Reglas: interÃ©s simple mensual; cada aporte vence en su aniversario con dÃ­a ancla
-- (fin de mes sin perder el ancla); monto = round_half_up(capital Ã— tasa) en cÃ©ntimos;
-- generaciÃ³n incremental e idempotente (vencidas hasta hoy + la prÃ³xima); fecha de
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

-- Suma meses respetando el dÃ­a ancla: 31-ene +1 â†’ 28-feb, +2 â†’ 31-mar.
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
-- Capital vigente de un aporte al final del dÃ­a p_date (devoluciones con fecha <= p_date).
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

-- Tasa vigente para el periodo k: el Ãºltimo cambio con from_period <= k, o la del aporte.
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

-- InterÃ©s del periodo [p_start, p_end).
--   periodo_completo: capital al inicio Ã— tasa (una devoluciÃ³n reduce desde el periodo siguiente)
--   prorrateo_diario: Î£(capital_dÃ­a) / dÃ­as_del_periodo Ã— tasa
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

-- Aplica saldo a favor a una cuota reciÃ©n generada.
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
-- (tras una devoluciÃ³n de capital o un cambio de tasa). Lo pagado nunca cambia.
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

-- Recalcula estados guardados de cuotas, aportes y lÃ­nea.
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

  -- LÃ­nea liquidada: tiene aportes y ninguno activo. 'cerrada' es manual y no se toca.
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

-- Genera las cuotas que falten: todas las vencidas hasta hoy + la prÃ³xima de cada aporte.
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
    raise exception 'LÃ­nea de inversiÃ³n no encontrada' using errcode = 'P0002';
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
      exit when v_k > 600;  -- 50 aÃ±os: tope de seguridad

      select b.period_start, b.due_date into v_start, v_due
        from public.inv_period_bounds(c.contributed_at, c.anchor_day, c.grace_months, v_k) b;
      v_base := public.inv_capital_at(c.id, v_start);
      exit when v_base <= 0;  -- sin capital: no hay mÃ¡s cuotas

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

-- Propuesta de imputaciÃ³n de un pago (no escribe nada).
-- AutomÃ¡tica: (1) cuotas pendientes por fecha de vencimiento (vencidas primero),
-- (2) kind capital/mixto â†’ capital FIFO, (3) resto â†’ saldo a favor (kind capital: error).
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
        raise exception 'Cada imputaciÃ³n debe tener un monto mayor a 0';
      end if;

      if v_item ->> 'target_type' = 'schedule' then
        select s.id, s.due_date, s.period_number, s.contribution_id,
               s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents as outstanding
          into r
          from public.interest_schedules s
         where s.id = (v_item ->> 'schedule_id')::uuid
           and s.line_id = p_line
           and s.status in ('programada','parcial');
        if not found then raise exception 'La cuota indicada no estÃ¡ pendiente en esta lÃ­nea'; end if;
        v_prev := coalesce((v_used ->> r.id::text)::bigint, 0);
        if v_prev + v_take > r.outstanding then
          raise exception 'La imputaciÃ³n supera el saldo de la cuota del % (%)',
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
        if not found then raise exception 'El aporte indicado no estÃ¡ activo en esta lÃ­nea'; end if;
        if r.contributed_at > p_paid_date then
          raise exception 'No se puede devolver capital antes de la fecha del aporte (%)', to_char(r.contributed_at, 'DD/MM/YYYY');
        end if;
        v_prev := coalesce((v_used ->> r.id::text)::bigint, 0);
        if v_prev + v_take > r.cap then
          raise exception 'La devoluciÃ³n supera el capital vigente del aporte (%)', public.inv_fmt(r.cap, v_currency);
        end if;
        v_used := v_used || jsonb_build_object(r.id::text, v_prev + v_take);
        v_plan := v_plan || jsonb_build_array(jsonb_build_object(
          'target_type', 'capital', 'contribution_id', r.id, 'contributed_at', r.contributed_at,
          'capital_before_cents', r.cap, 'amount_cents', v_take));

      elsif v_item ->> 'target_type' = 'credit' then
        v_plan := v_plan || jsonb_build_array(jsonb_build_object('target_type', 'credit', 'amount_cents', v_take));
      else
        raise exception 'Tipo de imputaciÃ³n no vÃ¡lido: %', v_item ->> 'target_type';
      end if;
      v_rem := v_rem - v_take;
    end loop;

    if v_rem <> 0 then
      raise exception 'Las imputaciones suman % y el pago es de %',
        public.inv_fmt(p_amount - v_rem, v_currency), public.inv_fmt(p_amount, v_currency);
    end if;
    return v_plan;
  end if;

  -- ---------------------------------------------------------------- automÃ¡tica
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
      raise exception 'El monto supera el capital vigente de la lÃ­nea en %', public.inv_fmt(v_rem, v_currency);
    end if;
  end if;

  if v_rem > 0 then
    v_plan := v_plan || jsonb_build_array(jsonb_build_object('target_type', 'credit', 'amount_cents', v_rem));
  end if;
  return v_plan;
end;
$$;

-- Advertencias de duplicado (no bloquean): nÃºmero de operaciÃ³n + mÃ©todo, o hash del voucher.
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
             'message', 'Ya hay un movimiento con el nÃºmero de operaciÃ³n ' || btrim(p_operation_code)
                        || ' (' || p_method || ') en esta lÃ­nea') as w
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
             'message', 'Este voucher ya se registrÃ³ en otro movimiento de esta lÃ­nea')
     where nullif(p_voucher_hash, '') is not null
       and (exists (select 1 from public.payments p
                     where p.line_id = p_line and p.status = 'activo' and p.voucher_hash = p_voucher_hash)
         or exists (select 1 from public.contributions c
                     where c.line_id = p_line and c.status <> 'anulado' and c.voucher_hash = p_voucher_hash))
  ) x
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 013_investments_rpc.sql
-- =====================================================================================
-- 013_investments_rpc.sql â€” RPC de inversiones (fase 1)
-- =====================================================================================
-- PatrÃ³n: `_inv_xxx(p_actor uuid, ...)` hace el trabajo y valida el rol del actor en la
-- lÃ­nea; solo la puede ejecutar service_role (el bot, con el user_id resuelto por
-- telÃ©fono/BSUID). El wrapper pÃºblico `xxx(...)` pasa auth.uid() y es lo que llama la app.
-- Todo es atÃ³mico (una RPC = una transacciÃ³n) y nada se borra.
-- Idempotente.
-- =====================================================================================

-- ==================================================================== lÃ­neas
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
    v_phone := '51' || v_phone;   -- celular peruano sin cÃ³digo de paÃ­s
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

-- Ajustes de la lÃ­nea (solo inversionista). p_patch admite:
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
    raise exception 'Solo el inversionista puede cambiar los ajustes de la lÃ­nea' using errcode = '42501';
  end if;
  select * into v_line from public.investment_lines where id = p_line_id for update;
  if v_line.status = 'cerrada' then raise exception 'La lÃ­nea estÃ¡ cerrada'; end if;

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

  -- Cambiar el modo de devoluciÃ³n recalcula las cuotas aÃºn no pagadas
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
    raise exception 'Solo el inversionista puede cerrar la lÃ­nea' using errcode = '42501';
  end if;
  perform public._inv_ensure_schedules(p_line_id);
  select * into v_line from public.investment_lines where id = p_line_id for update;
  if v_line.status = 'cerrada' then return; end if;
  if exists (select 1 from public.contributions where line_id = p_line_id and status = 'activo') then
    raise exception 'AÃºn hay capital o intereses pendientes: la lÃ­nea debe estar liquidada para cerrarla';
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
  if v_line.status = 'cerrada' then raise exception 'La lÃ­nea estÃ¡ cerrada'; end if;

  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_contributed_at is null then raise exception 'Indica la fecha del aporte'; end if;
  if p_contributed_at > public.inv_today() then raise exception 'La fecha del aporte no puede ser futura'; end if;
  if p_method = 'reinversion' then raise exception 'La reinversiÃ³n se registra desde una cuota pagada'; end if;
  if p_method not in ('yape','plin','transferencia','efectivo','otro') then raise exception 'MÃ©todo no vÃ¡lido'; end if;
  if v_grace < 0 or v_grace > 24 then raise exception 'La gracia debe estar entre 0 y 24 meses'; end if;

  v_rate := coalesce(p_monthly_rate, v_line.default_monthly_rate);
  if v_rate < 0 or v_rate > 1 then raise exception 'La tasa mensual debe estar entre 0 %% y 100 %%'; end if;
  v_anchor := coalesce(p_anchor_day, extract(day from p_contributed_at)::int);
  if v_anchor < 1 or v_anchor > 31 then raise exception 'El dÃ­a ancla debe estar entre 1 y 31'; end if;

  select coalesce(sum(amount_cents), 0) into v_delivered
    from public.contributions where line_id = p_line_id and status <> 'anulado';

  v_warnings := public._inv_duplicate_warnings(p_line_id, p_method, p_operation_code, p_voucher_hash);
  if v_line.committed_amount_cents > 0 and v_delivered + p_amount_cents > v_line.committed_amount_cents then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'cupo_excedido',
      'message', 'Con este aporte entregarÃ­as ' || public.inv_fmt(v_delivered + p_amount_cents, v_line.currency)
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
    raise exception 'No tienes acceso a esta lÃ­nea' using errcode = '42501';
  end if;
  select * into v_line from public.investment_lines where id = p_line_id for update;
  if v_line.status = 'cerrada' then raise exception 'La lÃ­nea estÃ¡ cerrada'; end if;

  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_paid_at is null then raise exception 'Indica la fecha del pago'; end if;
  if p_method = 'reinversion' then raise exception 'La reinversiÃ³n se registra desde la cuota'; end if;
  if p_method not in ('yape','plin','transferencia','efectivo','otro') then raise exception 'MÃ©todo no vÃ¡lido'; end if;
  if coalesce(p_kind, 'interes') not in ('interes','capital','mixto') then raise exception 'Tipo de pago no vÃ¡lido'; end if;

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
      'message', public.inv_fmt(v_credit, v_line.currency) || ' quedan como saldo a favor para las prÃ³ximas cuotas'));
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
-- Por aporte (p_contribution_id + p_from_period) o por lÃ­nea (p_line_id + p_effective_date:
-- aplica a cada aporte activo desde su primer periodo que empiece en esa fecha o despuÃ©s,
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
  if v_line is null then raise exception 'Indica el aporte o la lÃ­nea'; end if;
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
      if p_effective_date is null then raise exception 'Indica desde quÃ© fecha aplica la nueva tasa'; end if;
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
    raise exception 'El aporte no estÃ¡ activo';
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
-- Fase 1: anula movimientos propios aÃºn no confirmados por la contraparte.
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
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Indica el motivo de la anulaciÃ³n'; end if;

  if p_type = 'contribution' then
    select line_id, created_by, recon_status, status into v_line, v_by, v_recon, v_status
      from public.contributions where id = p_id;
  elsif p_type = 'payment' then
    select line_id, created_by, recon_status, status into v_line, v_by, v_recon, v_status
      from public.payments where id = p_id;
  else
    raise exception 'Tipo de movimiento no vÃ¡lido';
  end if;
  if v_line is null then raise exception 'Movimiento no encontrado' using errcode = 'P0002'; end if;
  if public._inv_line_role(v_line, p_actor) is null then raise exception 'No tienes acceso a esta lÃ­nea' using errcode = '42501'; end if;
  if v_by <> p_actor then raise exception 'Solo quien registrÃ³ el movimiento puede anularlo' using errcode = '42501'; end if;
  if v_status = 'anulado' then return; end if;
  if v_recon = 'confirmado' then
    raise exception 'El movimiento ya fue confirmado por la contraparte: su anulaciÃ³n debe confirmarse (fase 2)';
  end if;

  perform 1 from public.investment_lines where id = v_line for update;

  if p_type = 'contribution' then
    if exists (select 1 from public.payment_allocations a
                where a.contribution_id = p_id and a.voided_at is null) then
      raise exception 'El aporte tiene pagos o devoluciones registrados: anÃºlalos primero';
    end if;
    -- El saldo a favor aplicado a sus cuotas vuelve al saldo de la lÃ­nea
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

    -- Si el saldo a favor queda negativo, se deshacen las Ãºltimas aplicaciones
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
      -- si se devolviÃ³ de mÃ¡s, la diferencia vuelve como aplicaciÃ³n parcial
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
  if not found then raise exception 'LÃ­nea de inversiÃ³n no encontrada' using errcode = 'P0002'; end if;

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

-- PrÃ³ximos vencimientos (y vencidos) de las lÃ­neas del actor
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

-- Panel del inversionista: genera cuotas pendientes y devuelve KPIs + resumen por lÃ­nea
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

-- ==================================================================== wrappers pÃºblicos (app)
create or replace function public._inv_require_uid()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Necesitas iniciar sesiÃ³n' using errcode = '42501'; end if;
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

-- DevoluciÃ³n de capital = pago kind 'capital' (FIFO o aportes elegidos en p_allocations)
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
    raise exception 'No tienes acceso a esta lÃ­nea' using errcode = '42501';
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
    raise exception 'No tienes acceso a esta lÃ­nea' using errcode = '42501';
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
-- Internas (_inv_*): solo service_role. Wrappers: solo usuarios con sesiÃ³n.
-- Helpers inv_* de cÃ¡lculo: sin acceso anÃ³nimo.
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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 014_investments_rls.sql
-- =====================================================================================
-- 014_investments_rls.sql â€” QuiÃ©n ve quÃ©
-- =====================================================================================
-- El inversionista ve sus lÃ­neas; el gestor, solo las lÃ­neas donde es manager_user_id.
-- Solo hay policies de SELECT: no existe INSERT/UPDATE/DELETE directo (todo por RPC).
-- Idempotente.
-- =====================================================================================

create or replace function public.inv_is_line_member(p_line uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.investment_lines l
     where l.id = p_line
       and (l.investor_user_id = (select auth.uid()) or l.manager_user_id = (select auth.uid())))
$$;

create or replace function public.inv_is_line_investor(p_line uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.investment_lines l
     where l.id = p_line and l.investor_user_id = (select auth.uid()))
$$;

-- ------------------------------------------------------------------ policies de lectura
drop policy if exists "inv_lines_select" on public.investment_lines;
create policy "inv_lines_select" on public.investment_lines
  for select to authenticated
  using (investor_user_id = (select auth.uid()) or manager_user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['contributions','interest_schedules','payments','payment_allocations',
                           'credit_balance_movements','rate_changes','audit_log'] loop
    execute format('drop policy if exists "inv_%1$s_select" on public.%1$I', t);
    execute format(
      'create policy "inv_%1$s_select" on public.%1$I for select to authenticated
         using (public.inv_is_line_member(line_id))', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ vista de cuotas
-- Agrega el estado de negocio calculado (por_vencer / vencida) y los dÃ­as de atraso.
-- security_invoker: respeta el RLS de quien consulta.
create or replace view public.interest_schedules_view
with (security_invoker = true) as
select
  s.id, s.contribution_id, s.line_id, s.period_number, s.period_start, s.due_date,
  s.base_capital_cents, s.rate, s.amount_due_cents, s.amount_paid_cents, s.amount_waived_cents,
  s.status, s.paid_at, s.created_at, s.updated_at,
  c.contributed_at, c.amount_cents as contribution_amount_cents,
  greatest(s.amount_due_cents - s.amount_paid_cents - s.amount_waived_cents, 0) as outstanding_cents,
  case
    when s.status in ('pagada','condonada','anulada') then s.status
    when public.inv_today() > s.due_date + l.payment_grace_days then 'vencida'
    when s.due_date - public.inv_today() <= l.due_soon_days then 'por_vencer'
    else s.status
  end as display_status,
  case
    when s.status in ('pagada','condonada') and s.paid_at is not null then greatest(s.paid_at - s.due_date, 0)
    when s.status in ('programada','parcial') then greatest(public.inv_today() - s.due_date, 0)
    else 0
  end as days_late
from public.interest_schedules s
join public.investment_lines l on l.id = s.line_id
join public.contributions c on c.id = s.contribution_id;

revoke all on public.interest_schedules_view from anon;
revoke insert, update, delete, truncate on public.interest_schedules_view from authenticated;
grant select on public.interest_schedules_view to authenticated;

revoke execute on function public.inv_is_line_member(uuid)   from public, anon;
revoke execute on function public.inv_is_line_investor(uuid) from public, anon;
grant  execute on function public.inv_is_line_member(uuid)   to authenticated, service_role;
grant  execute on function public.inv_is_line_investor(uuid) to authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 015_vouchers_storage.sql
-- =====================================================================================
-- 015_vouchers_storage.sql â€” Bucket privado de vouchers
-- =====================================================================================
-- Ruta: investment-vouchers/{line_id}/{archivo}. Solo los miembros de la lÃ­nea leen y
-- suben; nadie edita ni borra (no hay policies de UPDATE/DELETE). Lectura con signed URLs.
-- ImÃ¡genes (comprimidas en el cliente) o PDF, mÃ¡x. 10 MB.
-- Idempotente.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('investment-vouchers', 'investment-vouchers', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create or replace function public.inv_try_uuid(p text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.inv_try_uuid(text) from public, anon;
grant  execute on function public.inv_try_uuid(text) to authenticated, service_role;

drop policy if exists "inv_vouchers_select" on storage.objects;
create policy "inv_vouchers_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'investment-vouchers'
         and public.inv_is_line_member(public.inv_try_uuid((storage.foldername(name))[1])));

drop policy if exists "inv_vouchers_insert" on storage.objects;
create policy "inv_vouchers_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'investment-vouchers'
              and public.inv_is_line_member(public.inv_try_uuid((storage.foldername(name))[1])));


commit;

-- Verificación: debe listar 7 tablas + audit_log
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('investment_lines','contributions','interest_schedules','payments','payment_allocations','credit_balance_movements','rate_changes','audit_log') order by 1;
