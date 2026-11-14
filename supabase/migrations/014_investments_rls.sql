-- =====================================================================================
-- 014_investments_rls.sql — Quién ve qué
-- =====================================================================================
-- El inversionista ve sus líneas; el gestor, solo las líneas donde es manager_user_id.
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
-- Agrega el estado de negocio calculado (por_vencer / vencida) y los días de atraso.
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
