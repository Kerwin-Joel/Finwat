-- =====================================================================================
-- 011_investments_audit.sql — Auditoría y "nada se borra"
-- =====================================================================================
-- audit_log guarda quién, qué, cuándo y el antes/después de cada cambio en las tablas
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

-- Actor de la operación: sesión de la app o el que fija una RPC interna
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
