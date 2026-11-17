-- =====================================================================================
-- Tests de 018 — préstamos al 0 % con comisión
-- =====================================================================================
-- Igual que fase1_tests.sql: cada test corre en una subtransacción que termina en
-- rollback; no queda nada. Requiere 010–018 aplicadas.
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

-- préstamo con comisión: S/ 1,000 el 10/01, comisión S/ 50, se paga el 10/02
create or replace function pg_temp.loan(p_actor uuid, p_line uuid, p_repay date default '2026-02-10')
returns uuid language sql as $$
  select (public._inv_register_contribution(p_actor, p_line, 100000, '2026-01-10', null, null, 0, 'yape',
          null, null, null, null, null, false, 'comision', 5000, p_repay) ->> 'contribution_id')::uuid;
$$;

do $tests$
declare
  I  constant uuid := '00000000-0000-4000-a000-0000000000a1';
  L  uuid; c uuid; c2 uuid; r jsonb;
  t_n int; t_name text;
begin
  -- =================================================================== 50
  t_n := 50; t_name := 'Comisión: una sola cuota por la comisión con vencimiento en la fecha de pago, aunque pasen los meses';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-01-20');
    L := public._inv_create_line(I, 'Pedro', null, 'PEN', 0, 0.10);
    r := public._inv_register_contribution(I, L, 100000, '2026-01-10', null, null, 0, 'yape',
           null, null, null, null, null, true, 'comision', 5000, '2026-02-10');
    perform pg_temp.eq(r -> 'preview' ->> 'commission_cents', '5000', 'preview comisión');
    perform pg_temp.eq(r -> 'preview' ->> 'first_due_date', '2026-02-10', 'preview vencimiento');
    c := pg_temp.loan(I, L);
    perform pg_temp.eq(pg_temp.sched(c, 1, 'amount_due_cents'), '5000', 'cuota = comisión');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'due_date'), '2026-02-10', 'vence en la fecha de pago');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'period_start'), '2026-01-10', 'desde el préstamo');
    perform pg_temp.eq((select repayment_date::text from public.contributions where id = c), '2026-02-10', 'fecha guardada');
    perform pg_temp.today('2026-06-01');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq((select count(*) from public.interest_schedules where contribution_id = c)::text, '1', 'no genera más cuotas');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'status'), 'programada', 'pendiente (vencida en la vista)');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 51
  t_n := 51; t_name := 'Pago de comisión + capital (mixto) en la fecha de pago: cubre la comisión, devuelve el capital y liquida';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-02-10');
    L := public._inv_create_line(I, 'Pedro', null, 'PEN', 0, 0.10);
    c := pg_temp.loan(I, L);
    r := public._inv_register_payment(I, L, 105000, '2026-02-10 10:00-05', 'yape', 'mixto');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'amount_paid_cents'), '5000', 'comisión pagada');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'status'), 'pagada', 'cuota pagada');
    perform pg_temp.eq(public.inv_capital_at(c, '2026-02-10')::text, '0', 'capital devuelto');
    perform pg_temp.eq((select status from public.contributions where id = c), 'liquidado', 'préstamo liquidado');
    perform pg_temp.eq((select status from public.investment_lines where id = L), 'liquidada', 'línea liquidada');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 52
  t_n := 52; t_name := 'Solo la comisión: la cuota queda pagada y el capital sigue pendiente; luego se devuelve el capital';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-02-10');
    L := public._inv_create_line(I, 'Pedro', null, 'PEN', 0, 0.10);
    c := pg_temp.loan(I, L);
    perform public._inv_register_payment(I, L, 5000, '2026-02-10 10:00-05', 'yape', 'interes');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'status'), 'pagada', 'comisión pagada');
    perform pg_temp.eq(public.inv_capital_at(c, '2026-02-10')::text, '100000', 'capital pendiente');
    perform pg_temp.eq((select status from public.contributions where id = c), 'activo', 'sigue activo');
    perform pg_temp.today('2026-03-15');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq((select count(*) from public.interest_schedules where contribution_id = c)::text, '1', 'sin nuevas comisiones');
    perform public._inv_register_payment(I, L, 100000, '2026-03-15 10:00-05', 'yape', 'capital');
    perform pg_temp.eq((select status from public.contributions where id = c), 'liquidado', 'liquidado al devolver');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 53
  t_n := 53; t_name := 'Validaciones: comisión y fecha de pago obligatorias; la fecha debe ser posterior al préstamo; tasa sigue igual';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-02-10');
    L := public._inv_create_line(I, 'Pedro', null, 'PEN', 0, 0.10);
    begin
      perform public._inv_register_contribution(I, L, 100000, '2026-01-10', null, null, 0, 'yape',
                null, null, null, null, null, false, 'comision', 5000, null);
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like '%fecha de pago%' then raise exception 'FAIL [sin fecha]: %', sqlerrm; end if;
    end;
    begin
      perform public._inv_register_contribution(I, L, 100000, '2026-01-10', null, null, 0, 'yape',
                null, null, null, null, null, false, 'comision', 5000, '2026-01-10');
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like '%posterior%' then raise exception 'FAIL [fecha igual]: %', sqlerrm; end if;
    end;
    begin
      perform public._inv_register_contribution(I, L, 100000, '2026-01-10', null, null, 0, 'yape',
                null, null, null, null, null, false, 'comision', null, '2026-02-10');
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like '%comisión%' then raise exception 'FAIL [sin comisión]: %', sqlerrm; end if;
    end;
    c := (public._inv_register_contribution(I, L, 30000, '2026-01-15') ->> 'contribution_id')::uuid;
    perform pg_temp.eq(pg_temp.sched(c, 1, 'amount_due_cents'), '3000', 'tasa 10 % intacta');
    perform pg_temp.eq((select repayment_date::text from public.contributions where id = c), null, 'tasa sin fecha de pago');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 54
  t_n := 54; t_name := 'Editar: cambiar la fecha de pago corrige el préstamo; editar solo la nota no lo corrige';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-01-20');
    L := public._inv_create_line(I, 'Pedro', null, 'PEN', 0, 0.10);
    c := pg_temp.loan(I, L);
    r := public._inv_update_contribution(I, c, 100000, '2026-01-10', 'comision', null, 5000, null, 0,
           'yape', null, null, 'Le presté para mercadería', null, '2026-02-10');
    perform pg_temp.eq(r ->> 'corrected', 'false', 'solo nota');
    r := public._inv_update_contribution(I, c, 100000, '2026-01-10', 'comision', null, 5000, null, 0,
           'yape', null, null, null, 'Se movió la fecha', '2026-03-10');
    c2 := (r ->> 'contribution_id')::uuid;
    perform pg_temp.eq(r ->> 'corrected', 'true', 'corrige');
    perform pg_temp.eq((select status from public.contributions where id = c), 'anulado', 'original anulado');
    perform pg_temp.eq(pg_temp.sched(c2, 1, 'due_date'), '2026-03-10', 'nueva fecha');
    perform pg_temp.eq(pg_temp.sched(c2, 1, 'amount_due_cents'), '5000', 'misma comisión');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;
end
$tests$;

select n, case when ok then 'PASS' else 'FAIL' end as resultado, name as test, detail as detalle
from inv_test_results order by n;
