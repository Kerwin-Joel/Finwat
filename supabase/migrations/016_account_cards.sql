-- =====================================================================================
-- 016_account_cards.sql — Cuentas y tarjetas personalizables
-- =====================================================================================
-- Aditiva: agrega columnas OPCIONALES a accounts (todas aceptan null o tienen default),
-- así que el bot y la app actual siguen funcionando igual. El saldo lo sigue calculando
-- el trigger sync_account_balance (no se toca).
-- set_default_account: cambia la cuenta principal en un solo UPDATE (nunca quedan 0 ni 2
-- principales, que el bot necesita para guardar los gastos de WhatsApp).
-- Idempotente.
-- =====================================================================================

alter table public.accounts add column if not exists card_network text;   -- visa | mastercard | amex | diners | otra
alter table public.accounts add column if not exists card_kind    text;   -- debito | credito
alter table public.accounts add column if not exists last4        text;
alter table public.accounts add column if not exists bank_name    text;
alter table public.accounts add column if not exists card_style   text not null default 'aurora';
alter table public.accounts add column if not exists credit_limit numeric;
alter table public.accounts add column if not exists sort_order   integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_card_network_check') then
    alter table public.accounts add constraint accounts_card_network_check
      check (card_network is null or card_network in ('visa','mastercard','amex','diners','otra'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_card_kind_check') then
    alter table public.accounts add constraint accounts_card_kind_check
      check (card_kind is null or card_kind in ('debito','credito'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_last4_check') then
    alter table public.accounts add constraint accounts_last4_check
      check (last4 is null or last4 ~ '^[0-9]{4}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_card_style_check') then
    alter table public.accounts add constraint accounts_card_style_check
      check (card_style in ('aurora','medianoche','oceano','esmeralda','atardecer','oro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_credit_limit_check') then
    alter table public.accounts add constraint accounts_credit_limit_check
      check (credit_limit is null or credit_limit >= 0);
  end if;
end $$;

create or replace function public.set_default_account(p_account_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.accounts where id = p_account_id and user_id = v_uid and is_active
  ) then
    raise exception 'Cuenta no encontrada';
  end if;
  update public.accounts
     set is_default = (id = p_account_id)
   where user_id = v_uid
     and (is_default or id = p_account_id);
end;
$$;

revoke execute on function public.set_default_account(uuid) from public, anon;
grant execute on function public.set_default_account(uuid) to authenticated, service_role;
