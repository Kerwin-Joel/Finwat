-- =====================================================================================
-- Tests de 017 — monto fijo, sin interés y editar/corregir aportes
-- =====================================================================================
-- Igual que fase1_tests.sql: cada test corre en una subtransacción que termina en
-- rollback; no queda nada. Requiere 010–017 aplicadas.
-- =====================================================================================

drop table if exists pg_temp.inv_test_results;
create temp table inv_test_results (n int, name text, ok boolean, detail text);

create or replace function pg_temp.eq(p_actual text, p_expected text, p_label text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL [%]: esperado %, obtenido %', p_label, coalesce(p_expected, 'NULL'), coalesce(p_actual, 'NULL');
  end if;
end $$;

create or replace function pg_temp.mk_user(p_id uuid, p_email text)
returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
          '{}'::jsonb, '{}'::jsonb, now(), now());
$$;

create or replace function pg_temp.today(p date)
returns void language sql as $$ select set_config('finwat.today', p::text, true); $$;

create or replace function pg_temp.sched(p_contribution uuid, p_k int, p_col text)
returns text language plpgsql as $$
declare v text;
begin
  execute format('select %I::text from public.interest_schedules where contribution_id = $1 and period_number = $2', p_col)
    into v using p_contribution, p_k;
  return v;
end $$;

do $tests$
declare
  I  constant uuid := '00000000-0000-4000-a000-0000000000a1';
  L  uuid; c uuid; c2 uuid; r jsonb; n int;
  t_n int; t_name text;
begin
  -- =================================================================== 40
  t_n := 40; t_name := 'Monto fijo: S/ 150 cada mes sin importar el capital; se mantiene con devolución parcial y se detiene con la total';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 0, 0.10);
    r := public._inv_register_contribution(I, L, 100000, '2026-01-15', null, null, 0, 'transferencia',
           null, null, null, null, null, false, 'monto_fijo', 15000);
    c := (r ->> 'contribution_id')::uuid;
    perform pg_temp.eq(r -> 'preview' ->> 'monthly_interest_cents', '15000', 'preview');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'amount_due_cents'), '15000', 'P1');
    perform pg_temp.eq(pg_temp.sched(c, 2, 'amount_due_cents'), '15000', 'P2');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'rate'), '0.0000', 'sin tasa');
    perform public._inv_register_payment(I, L, 50000, '2026-03-20 10:00-05', 'transferencia', 'capital');
    perform pg_temp.today('2026-04-20');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq(pg_temp.sched(c, 4, 'amount_due_cents'), '15000', 'P4 sigue fijo con medio capital');
    perform public._inv_register_payment(I, L, 50000, '2026-04-20 10:00-05', 'transferencia', 'capital');
    perform pg_temp.today('2026-07-01');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq((select count(*) from public.interest_schedules where contribution_id = c and status <> 'anulada')::text, '4', 'sin cuotas tras devolver todo');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 41
  t_n := 41; t_name := 'Sin interés: no genera cuotas; al devolver todo el capital el aporte y la línea quedan liquidados';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-05-20');
    L := public._inv_create_line(I, 'Rosa', null, 'PEN', 0, 0.10);
    r := public._inv_register_contribution(I, L, 80000, '2026-01-10', null, null, 0, 'yape',
           null, null, null, null, null, false, 'sin_interes', null);
    c := (r ->> 'contribution_id')::uuid;
    perform pg_temp.eq((select count(*) from public.interest_schedules where contribution_id = c)::text, '0', 'sin cuotas');
    perform pg_temp.eq(r -> 'preview' ->> 'first_due_date', null, 'sin primer vencimiento');
    perform public._inv_register_payment(I, L, 80000, '2026-05-20 10:00-05', 'yape', 'capital');
    perform pg_temp.eq((select status from public.contributions where id = c), 'liquidado', 'aporte liquidado');
    perform pg_temp.eq((select status from public.investment_lines where id = L), 'liquidada', 'línea liquidada');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 42
  t_n := 42; t_name := 'Editar datos no financieros (nota, operación, banco) cambia el mismo aporte';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 0, 0.10);
    c := (public._inv_register_contribution(I, L, 30000, '2026-01-15') ->> 'contribution_id')::uuid;
    r := public._inv_update_contribution(I, c, 30000, '2026-01-15', 'tasa', 0.10, null, 15, 0,
           'yape', 'BCP', 'OP-9', 'Le di en efectivo al final');
    perform pg_temp.eq(r ->> 'corrected', 'false', 'no corrige');
    perform pg_temp.eq(r ->> 'contribution_id', c::text, 'mismo id');
    perform pg_temp.eq((select notes from public.contributions where id = c), 'Le di en efectivo al final', 'nota');
    perform pg_temp.eq((select method from public.contributions where id = c), 'yape', 'método');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 43
  t_n := 43; t_name := 'Corregir el monto anula el aporte original y registra uno nuevo con sus cuotas';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 0, 0.10);
    c := (public._inv_register_contribution(I, L, 30000, '2026-01-15') ->> 'contribution_id')::uuid;
    r := public._inv_update_contribution(I, c, 50000, '2026-01-15', 'tasa', 0.10, null, 15, 0,
           'transferencia', null, null, null, 'Era 500, no 300');
    c2 := (r ->> 'contribution_id')::uuid;
    perform pg_temp.eq(r ->> 'corrected', 'true', 'corrige');
    perform pg_temp.eq((select status from public.contributions where id = c), 'anulado', 'original anulado');
    perform pg_temp.eq((select void_reason from public.contributions where id = c), 'Corregido: Era 500, no 300', 'motivo');
    perform pg_temp.eq(pg_temp.sched(c2, 1, 'amount_due_cents'), '5000', 'nueva cuota 50');
    perform pg_temp.eq((select count(*) from public.contributions where line_id = L and status = 'activo')::text, '1', 'uno activo');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 44
  t_n := 44; t_name := 'No se corrige el monto de un aporte con pagos; tampoco se cambia la tasa a un aporte de monto fijo';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 0, 0.10);
    c := (public._inv_register_contribution(I, L, 30000, '2026-01-15') ->> 'contribution_id')::uuid;
    perform public._inv_register_payment(I, L, 3000, '2026-03-20 10:00-05', 'yape');
    begin
      perform public._inv_update_contribution(I, c, 40000, '2026-01-15', 'tasa', 0.10, null, 15, 0,
                'transferencia', null, null, null, null);
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like '%ya tiene pagos%' then raise exception 'FAIL [con pagos]: %', sqlerrm; end if;
    end;
    c2 := (public._inv_register_contribution(I, L, 100000, '2026-02-01', null, null, 0, 'transferencia',
            null, null, null, null, null, false, 'monto_fijo', 10000) ->> 'contribution_id')::uuid;
    begin
      perform public._inv_change_rate(I, 0.05, 'intento', c2, 1);
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like '%no usa tasa%' then raise exception 'FAIL [tasa a monto fijo]: %', sqlerrm; end if;
    end;
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;
end
$tests$;

select n, case when ok then 'PASS' else 'FAIL' end as resultado, name as test, detail as detalle
from inv_test_results order by n;
