-- =====================================================================================
-- 010_investments_schema.sql — Inversiones con gestores: tablas
-- =====================================================================================
-- Aditiva: no toca ninguna tabla existente. Montos en bigint (céntimos), tasas numeric(6,4).
-- Las tablas nacen con RLS activo y SIN permisos de escritura para anon/authenticated:
-- toda escritura va por las RPC de 013. Las policies de lectura están en 014.
-- Idempotente.
-- =====================================================================================

-- ------------------------------------------------------------------ líneas de inversión
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
  source_payment_id uuid,                                   -- reinversión (fase 4)
  notes             text,
  created_by        uuid not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint contributions_void_has_reason
    check (status <> 'anulado' or (void_reason is not null and voided_at is not null))
);
create index if not exists contributions_line_idx on public.contributions (line_id, contributed_at);

-- ------------------------------------------------------------------ cuotas de interés
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
  paid_at             date,                                 -- fecha en que quedó cubierta
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
-- + excedente de un pago / − aplicación a una cuota generada después
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
