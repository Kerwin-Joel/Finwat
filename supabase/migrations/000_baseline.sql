-- =====================================================================================
-- 000_baseline.sql — Esquema `public` de PRODUCCIÓN (tcltpyhxxgmwlhvztuba) al 2026-11-13
-- =====================================================================================
-- Leído en solo lectura con el MCP de Supabase (columnas, constraints, enums, índices,
-- funciones, triggers y policies). Copia fiel: los defectos de producción se dejan
-- tal cual y se corrigen en migraciones posteriores (ver 001_security_fixes.sql).
--
-- Uso: referencia del esquema de partida (Finwat usa un solo proyecto Supabase).
-- NO se aplica: todo esto ya existe. Sirve para revisar el punto de partida y para
-- reconstruir la base desde cero si algún día hiciera falta. Es idempotente.
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ------------------------------------------------------------------ enums
do $$
declare
  e record;
begin
  for e in
    select * from (values
      ('account_type',        array['cash','bank','card','wallet','other']),
      ('installment_status',  array['pending','paid','overdue']),
      ('interest_period',     array['weekly','biweekly','monthly','bimonthly','quarterly','semiannual','annual']),
      ('interest_type',       array['simple','compound']),
      ('loan_direction',      array['given','received']),
      ('loan_status',         array['active','paid','overdue','refinanced']),
      ('loan_type',           array['personal','bank','credit_card']),
      ('reminder_recurrence', array['none','daily','weekly','monthly']),
      ('reminder_status',     array['pending','completed','dismissed']),
      ('reminder_type',       array['debt','service','free','credit_card']),
      ('transaction_source',  array['app','whatsapp','import','api','scheduled']),
      ('transaction_status',  array['completed','pending','cancelled']),
      ('transaction_type',    array['income','expense','debt_given','debt_received'])
    ) as t(name, vals)
  loop
    if not exists (
      select 1 from pg_type where typname = e.name and typnamespace = 'public'::regnamespace
    ) then
      execute format(
        'create type public.%I as enum (%s)',
        e.name,
        (select string_agg(quote_literal(v), ',') from unnest(e.vals) v)
      );
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------ tablas
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  phone             text unique,
  full_name         text,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  savings_goal      numeric default 500,
  category_budgets  jsonb default '{}'::jsonb,
  custom_categories jsonb default '{}'::jsonb,
  whatsapp_user_id  text unique            -- BSUID de Meta (usuarios con username)
);

create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  type       public.account_type default 'cash',
  currency   text default 'USD',
  balance    numeric default 0,             -- lo mantiene el trigger sync_account_balance
  is_default boolean default true,
  is_active  boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  account_id        uuid references public.accounts(id) on delete set null,
  type              public.transaction_type not null,
  amount            numeric not null check (amount > 0),
  currency          text default 'USD',
  description       text,
  category          text,
  tags              text[],
  transaction_date  date not null default current_date,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  source            public.transaction_source default 'app',
  source_metadata   jsonb,
  status            public.transaction_status default 'completed',
  counterpart_name  text,
  counterpart_phone text,
  due_date          date,
  is_settled        boolean default false,
  settled_at        timestamptz,
  notes             text,
  attachment_url    text
);

create table if not exists public.reminders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  title              text not null,
  type               public.reminder_type not null default 'free',
  amount             numeric,
  due_date           date not null,
  due_time           time,
  notify_advance     integer default 0,
  recurrence         public.reminder_recurrence default 'none',
  status             public.reminder_status default 'pending',
  whatsapp_confirmed boolean default false,
  notes              text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  last_notified_at   timestamptz,
  -- producción tiene DOS FK sobre user_id (auth.users y profiles); el bot usa la de profiles
  constraint reminders_user_id_fkey_profiles
    foreign key (user_id) references public.profiles(id) on delete cascade
);

create table if not exists public.loans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  type               public.loan_type not null,
  direction          public.loan_direction not null,
  entity_name        text not null,
  principal          numeric not null,
  balance_remaining  numeric not null,
  interest_rate      numeric default 0,
  interest_period    public.interest_period default 'monthly',
  interest_type      public.interest_type default 'simple',
  start_date         date not null,
  due_date           date,
  installments_total integer default 1,
  installments_paid  integer default 0,
  installment_amount numeric,
  status             public.loan_status default 'active',
  notes              text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists public.loan_installments (
  id                 uuid primary key default gen_random_uuid(),
  loan_id            uuid not null references public.loans(id) on delete cascade,
  installment_number integer not null,
  due_date           date not null,
  amount             numeric not null,
  principal_amount   numeric default 0,
  interest_amount    numeric default 0,
  insurance_amount   numeric default 0,
  status             public.installment_status default 'pending',
  paid_at            timestamptz,
  created_at         timestamptz default now()
);

create table if not exists public.loan_payments (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references public.loans(id) on delete cascade,
  amount       numeric not null,
  payment_date date not null,
  notes        text,
  created_at   timestamptz default now()
);

create table if not exists public.loan_bank_details (
  id                uuid primary key default gen_random_uuid(),
  loan_id           uuid not null references public.loans(id) on delete cascade,
  bank_name         text,
  contract_number   text,
  tea               numeric,
  tem               numeric,
  tcea              numeric,
  insurance         numeric default 0,
  disbursement_date date,
  created_at        timestamptz default now()
);

create table if not exists public.loan_history (
  id            uuid primary key default gen_random_uuid(),
  loan_id       uuid not null references public.loans(id) on delete cascade,
  field_changed text not null,
  old_value     text,
  new_value     text,
  changed_at    timestamptz default now()
);

-- ------------------------------------------------------------------ índices
create index if not exists idx_transactions_account_id on public.transactions (account_id);
create index if not exists idx_transactions_date       on public.transactions (transaction_date desc);
create index if not exists idx_transactions_source     on public.transactions (source);
create index if not exists idx_transactions_status     on public.transactions (status);
create index if not exists idx_transactions_type       on public.transactions (type);
create index if not exists idx_transactions_user_id    on public.transactions (user_id);

-- ------------------------------------------------------------------ funciones (copia literal de producción)
create or replace function public.update_updated_at()
returns trigger language plpgsql as $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

create or replace function public.sync_account_balance()
returns trigger language plpgsql security definer as $function$
DECLARE v_account_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_account_id := OLD.account_id;
  ELSE v_account_id := NEW.account_id; END IF;

  -- LOG
  RAISE NOTICE 'TRIGGER ejecutado: %, account: %, tx: %', TG_OP, v_account_id, COALESCE(NEW.id, OLD.id);

  UPDATE accounts SET balance = (
    SELECT COALESCE(
      SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0)
    FROM transactions
    WHERE account_id = v_account_id AND status = 'completed'
  ), updated_at = NOW()
  WHERE id = v_account_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

create or replace function public.create_profile_on_signup()
returns trigger language plpgsql security definer as $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error creating profile: %', SQLERRM;
  RETURN NEW;
END;
$function$;

create or replace function public.create_default_account()
returns trigger language plpgsql security definer as $function$
BEGIN
  INSERT INTO public.accounts (user_id, name, type, currency, balance, is_default, is_active)
  VALUES (NEW.id, 'Mi cuenta', 'cash', 'PEN', 0, true, true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error creating default account: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------ triggers
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_on_signup();

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function public.create_default_account();

drop trigger if exists set_updated_at_accounts on public.accounts;
create trigger set_updated_at_accounts
  before update on public.accounts
  for each row execute function public.update_updated_at();

drop trigger if exists set_updated_at_transactions on public.transactions;
create trigger set_updated_at_transactions
  before update on public.transactions
  for each row execute function public.update_updated_at();

drop trigger if exists trigger_sync_balance on public.transactions;
create trigger trigger_sync_balance
  after insert or update or delete on public.transactions
  for each row execute function public.sync_account_balance();

drop trigger if exists set_loans_updated_at on public.loans;
create trigger set_loans_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ RLS
alter table public.profiles          enable row level security;
alter table public.accounts          enable row level security;
alter table public.transactions      enable row level security;
alter table public.reminders         enable row level security;
alter table public.loans             enable row level security;
alter table public.loan_installments enable row level security;
alter table public.loan_payments     enable row level security;
alter table public.loan_bank_details enable row level security;
alter table public.loan_history      enable row level security;

-- profiles (ojo: producción no tiene policy de INSERT → ver 001)
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- accounts
drop policy if exists "Users can view own accounts" on public.accounts;
create policy "Users can view own accounts" on public.accounts
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts" on public.accounts
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts" on public.accounts
  for update using (auth.uid() = user_id);

-- transactions
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions" on public.transactions
  for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

-- reminders (ojo: la segunda policy es un agujero de producción → la quita 001)
drop policy if exists "Users can manage their reminders" on public.reminders;
create policy "Users can manage their reminders" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Service role can update reminders" on public.reminders;
create policy "Service role can update reminders" on public.reminders
  for update using (true) with check (true);

-- loans y tablas hijas
drop policy if exists "Users can manage their loans" on public.loans;
create policy "Users can manage their loans" on public.loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their loan installments" on public.loan_installments;
create policy "Users can manage their loan installments" on public.loan_installments
  for all
  using      (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_installments.loan_id))
  with check (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_installments.loan_id));

drop policy if exists "Users can manage their loan payments" on public.loan_payments;
create policy "Users can manage their loan payments" on public.loan_payments
  for all
  using      (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_payments.loan_id))
  with check (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_payments.loan_id));

drop policy if exists "Users can manage their loan bank details" on public.loan_bank_details;
create policy "Users can manage their loan bank details" on public.loan_bank_details
  for all
  using      (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_bank_details.loan_id))
  with check (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_bank_details.loan_id));

drop policy if exists "Users can view their loan history" on public.loan_history;
create policy "Users can view their loan history" on public.loan_history
  for all
  using      (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_history.loan_id))
  with check (auth.uid() = (select loans.user_id from public.loans where loans.id = loan_history.loan_id));
