-- =====================================================================================
-- Tests de la Fase 1 — motor de intereses, pagos, devoluciones y RLS
-- =====================================================================================
-- Se pueden correr en el proyecto real: cada test corre en una subtransacción que
-- SIEMPRE termina en rollback (crea sus usuarios y datos y los descarta). No queda nada.
-- Resultado: tabla con PASS/FAIL por test al final.
-- Uso: SQL Editor → pegar todo → Run (como postgres).
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

create or replace function pg_temp.contrib(p_actor uuid, p_line uuid, p_cents bigint, p_date date,
                                          p_rate numeric default null, p_grace int default 0)
returns uuid language sql as $$
  select (public._inv_register_contribution(p_actor, p_line, p_cents, p_date, p_rate, null, p_grace)
          ->> 'contribution_id')::uuid;
$$;

create or replace function pg_temp.sched(p_contribution uuid, p_k int, p_col text)
returns text language plpgsql as $$
declare v text;
begin
  execute format('select %I::text from public.interest_schedules_view where contribution_id = $1 and period_number = $2', p_col)
    into v using p_contribution, p_k;
  return v;
end $$;

-- ------------------------------------------------------------------------------------
do $tests$
declare
  I   constant uuid := '00000000-0000-4000-a000-0000000000a1';  -- inversionista
  M1  constant uuid := '00000000-0000-4000-a000-0000000000a2';  -- gestor A
  M2  constant uuid := '00000000-0000-4000-a000-0000000000a3';  -- gestor B
  L   uuid; L2 uuid;
  c300 uuid; c1000 uuid; c500 uuid; c uuid;
  r   jsonb; v text; n bigint; pid uuid;
  t_n int; t_name text;
begin
  -- =================================================================== 1
  t_n := 1; t_name := 'Aporte 300 el 15-01 → cuotas de 30 el 15-02 y 15-03';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'due_date'), '2026-02-15', 'P1 vence');
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'amount_due_cents'), '3000', 'P1 monto');
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'due_date'), '2026-03-15', 'P2 vence');
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'amount_due_cents'), '3000', 'P2 monto');
    perform pg_temp.eq(pg_temp.sched(c300, 3, 'due_date'), '2026-04-15', 'P3 (próxima) vence');
    perform pg_temp.eq((select count(*) from public.interest_schedules where contribution_id = c300)::text, '3', 'vencidas + la próxima');
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'display_status'), 'vencida', 'P1 vencida');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 2
  t_n := 2; t_name := 'Aporte 1000 el 31-01 → 28-02, 31-03, 30-04, 31-05 (ancla intacta), cuota 100';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-04-30');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c1000 := pg_temp.contrib(I, L, 100000, '2026-01-31');
    perform pg_temp.eq(pg_temp.sched(c1000, 1, 'due_date'), '2026-02-28', 'P1');
    perform pg_temp.eq(pg_temp.sched(c1000, 2, 'due_date'), '2026-03-31', 'P2');
    perform pg_temp.eq(pg_temp.sched(c1000, 3, 'due_date'), '2026-04-30', 'P3');
    perform pg_temp.eq(pg_temp.sched(c1000, 4, 'due_date'), '2026-05-31', 'P4');
    perform pg_temp.eq(pg_temp.sched(c1000, 2, 'period_start'), '2026-02-28', 'P2 inicia');
    perform pg_temp.eq(pg_temp.sched(c1000, 3, 'amount_due_cents'), '10000', 'monto');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 3
  t_n := 3; t_name := 'Aporte 500 el 03-02 → 03-03, 03-04 de 50; entregado 1800, por entregar 3200';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-04-05');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    c1000 := pg_temp.contrib(I, L, 100000, '2026-01-31');
    c500 := pg_temp.contrib(I, L, 50000, '2026-02-03');
    perform pg_temp.eq(pg_temp.sched(c500, 1, 'due_date'), '2026-03-03', 'P1');
    perform pg_temp.eq(pg_temp.sched(c500, 2, 'due_date'), '2026-04-03', 'P2');
    perform pg_temp.eq(pg_temp.sched(c500, 1, 'amount_due_cents'), '5000', 'monto');
    r := public._inv_line_summary(L);
    perform pg_temp.eq(r ->> 'delivered_cents', '180000', 'entregado');
    perform pg_temp.eq(r ->> 'to_deliver_cents', '320000', 'por entregar');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 4
  t_n := 4; t_name := 'Pago 80 el 16-02 → 30 a la del 15-02 (pagada, 1 día) y 50 a la del 28-02 (parcial)';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-02-16');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    c1000 := pg_temp.contrib(I, L, 100000, '2026-01-31');
    c500 := pg_temp.contrib(I, L, 50000, '2026-02-03');
    r := public._inv_register_payment(I, L, 8000, '2026-02-16 10:00-05', 'yape');
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'status'), 'pagada', '15-02 estado');
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'days_late'), '1', '15-02 atraso');
    perform pg_temp.eq(pg_temp.sched(c1000, 1, 'status'), 'parcial', '28-02 estado');
    perform pg_temp.eq(pg_temp.sched(c1000, 1, 'amount_paid_cents'), '5000', '28-02 pagado');
    perform pg_temp.eq(pg_temp.sched(c1000, 1, 'outstanding_cents'), '5000', '28-02 saldo');
    perform pg_temp.eq(pg_temp.sched(c500, 1, 'amount_paid_cents'), '0', '03-03 sin tocar');
    perform pg_temp.eq((r ->> 'credit_cents'), '0', 'sin saldo a favor');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 5
  t_n := 5; t_name := 'Pago 200 debiendo 130 → 70 a saldo a favor, aplicado solo a la siguiente cuota generada';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-02-10');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    c1000 := pg_temp.contrib(I, L, 100000, '2026-01-31');
    perform pg_temp.eq((select sum(amount_due_cents) from public.interest_schedules where line_id = L)::text, '13000', 'debe 130');
    -- previsualización: no escribe
    r := public._inv_register_payment(I, L, 20000, '2026-02-10 09:00-05', 'transferencia', 'interes', null,
                                      null, null, null, null, null, null, null, true);
    perform pg_temp.eq(r ->> 'credit_cents', '7000', 'dry_run saldo a favor');
    perform pg_temp.eq((select count(*) from public.payments where line_id = L)::text, '0', 'dry_run no escribe');
    r := public._inv_register_payment(I, L, 20000, '2026-02-10 09:00-05', 'transferencia');
    perform pg_temp.eq(public._inv_credit_balance(L)::text, '7000', 'saldo a favor 70');
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'status'), 'pagada', '15-02 pagada');
    perform pg_temp.eq(pg_temp.sched(c1000, 1, 'status'), 'pagada', '28-02 pagada');
    perform pg_temp.today('2026-02-16');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'amount_paid_cents'), '3000', '15-03 cubierta con saldo');
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'status'), 'pagada', '15-03 pagada');
    perform pg_temp.eq(public._inv_credit_balance(L)::text, '4000', 'saldo restante 40');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 6a
  t_n := 6; t_name := 'Devolución 500 del aporte de 1000 el 10-03 (periodo_completo) → 31-03 100 y 30-04 50';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-10');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10, 'periodo_completo');
    c1000 := pg_temp.contrib(I, L, 100000, '2026-01-31');
    r := public._inv_register_payment(I, L, 50000, '2026-03-10 12:00-05', 'transferencia', 'capital');
    perform pg_temp.eq((r -> 'allocations' -> 0 ->> 'target_type'), 'capital', 'imputado a capital');
    perform pg_temp.today('2026-04-01');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq(pg_temp.sched(c1000, 2, 'amount_due_cents'), '10000', '31-03');
    perform pg_temp.eq(pg_temp.sched(c1000, 3, 'amount_due_cents'), '5000', '30-04');
    perform pg_temp.eq(public.inv_capital_at(c1000, 'infinity')::text, '50000', 'capital vigente');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 6b
  t_n := 7; t_name := 'Devolución 500 el 10-03 (prorrateo_diario) → 31-03 = 66.13, 30-04 = 50';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-10');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10, 'prorrateo_diario');
    c1000 := pg_temp.contrib(I, L, 100000, '2026-01-31');
    perform public._inv_register_payment(I, L, 50000, '2026-03-10 12:00-05', 'transferencia', 'capital');
    perform pg_temp.eq(pg_temp.sched(c1000, 2, 'amount_due_cents'), '6613', '31-03 prorrateada');
    perform pg_temp.today('2026-04-01');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq(pg_temp.sched(c1000, 3, 'amount_due_cents'), '5000', '30-04');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 7
  t_n := 8; t_name := 'Tasa a 8 % desde el periodo 3 del aporte de 300 → P1–P2 30, desde P3 24; lo pagado no cambia';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-04-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    perform public._inv_register_payment(I, L, 6000, '2026-04-20 10:00-05', 'yape');
    perform public._inv_change_rate(I, 0.08, 'Acuerdo nuevo', c300, 3);
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'amount_due_cents'), '3000', 'P1');
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'amount_due_cents'), '3000', 'P2');
    perform pg_temp.eq(pg_temp.sched(c300, 3, 'amount_due_cents'), '2400', 'P3');
    perform pg_temp.eq(pg_temp.sched(c300, 4, 'amount_due_cents'), '2400', 'P4');
    perform pg_temp.today('2026-05-20');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq(pg_temp.sched(c300, 5, 'amount_due_cents'), '2400', 'P5 nueva con 8 %');
    begin
      perform public._inv_change_rate(I, 0.05, 'retroactivo', c300, 2);
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like '%ya tiene pagos%' then raise exception 'FAIL [retroactivo]: %', sqlerrm; end if;
    end;
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 8
  t_n := 9; t_name := 'Aporte 3500 con 1800 entregados → advertencia de cupo (5300 > 5000) sin bloqueo';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-04-05');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    perform pg_temp.contrib(I, L, 30000, '2026-01-15');
    perform pg_temp.contrib(I, L, 100000, '2026-01-31');
    perform pg_temp.contrib(I, L, 50000, '2026-02-03');
    r := public._inv_register_contribution(I, L, 350000, '2026-04-01');
    perform pg_temp.eq((select x ->> 'code' from jsonb_array_elements(r -> 'warnings') x where x ->> 'code' = 'cupo_excedido'), 'cupo_excedido', 'advertencia');
    perform pg_temp.eq((select x ->> 'delivered_after_cents' from jsonb_array_elements(r -> 'warnings') x where x ->> 'code' = 'cupo_excedido'), '530000', 'entregaría 5300');
    perform pg_temp.eq((r ->> 'contribution_id' is not null)::text, 'true', 'se registró igual');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 9
  t_n := 10; t_name := 'Número de operación repetido → advertencia de duplicado';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    perform pg_temp.contrib(I, L, 30000, '2026-01-15');
    r := public._inv_register_payment(I, L, 3000, '2026-03-20 10:00-05', 'yape', 'interes', null, null, 'OP-123');
    perform pg_temp.eq(jsonb_array_length(r -> 'warnings')::text, '0', 'primero sin advertencia');
    r := public._inv_register_payment(I, L, 3000, '2026-03-20 11:00-05', 'yape', 'interes', null, null, 'op-123');
    perform pg_temp.eq((r -> 'warnings' -> 0 ->> 'code'), 'operacion_duplicada', 'duplicado');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 11
  t_n := 11; t_name := 'Gracia de 1 mes en aporte del 10-01 → primera cuota el 10-03';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-15');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c := pg_temp.contrib(I, L, 30000, '2026-01-10', null, 1);
    perform pg_temp.eq(pg_temp.sched(c, 1, 'period_start'), '2026-02-10', 'P1 inicia');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'due_date'), '2026-03-10', 'P1 vence');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'amount_due_cents'), '3000', 'P1 monto');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 14
  t_n := 14; t_name := 'ensure_schedules dos veces no duplica cuotas';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-06-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    perform pg_temp.contrib(I, L, 30000, '2026-01-15');
    perform pg_temp.contrib(I, L, 100000, '2026-01-31');
    n := (select count(*) from public.interest_schedules where line_id = L);
    perform pg_temp.eq(public._inv_ensure_schedules(L)::text, '0', 'segunda vez no crea');
    perform pg_temp.eq(public._inv_ensure_schedules(L)::text, '0', 'tercera vez no crea');
    perform pg_temp.eq((select count(*) from public.interest_schedules where line_id = L)::text, n::text, 'mismo total');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== 15
  t_n := 15; t_name := 'Aporte del 29-02-2028 → 29-03, 29-04 y en 2029 el 28-02';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2029-03-01');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c := pg_temp.contrib(I, L, 30000, '2028-02-29');
    perform pg_temp.eq(pg_temp.sched(c, 1, 'due_date'), '2028-03-29', 'P1');
    perform pg_temp.eq(pg_temp.sched(c, 2, 'due_date'), '2028-04-29', 'P2');
    perform pg_temp.eq(pg_temp.sched(c, 12, 'due_date'), '2029-02-28', 'P12');
    perform pg_temp.eq(pg_temp.sched(c, 13, 'due_date'), '2029-03-29', 'P13 recupera el 29');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== extra: anular pago
  t_n := 20; t_name := 'Anular un pago revierte imputaciones y el saldo a favor ya aplicado';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-02-10');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    r := public._inv_register_payment(I, L, 10000, '2026-02-10 09:00-05', 'yape');   -- 30 a la cuota, 70 a favor
    pid := (r ->> 'payment_id')::uuid;
    perform pg_temp.today('2026-02-16');
    perform public._inv_ensure_schedules(L);                                       -- 15-03 se cubre con saldo
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'amount_paid_cents'), '3000', 'antes: P2 cubierta');
    perform public._inv_void_movement(I, 'payment', pid, 'Monto equivocado');
    perform pg_temp.eq(pg_temp.sched(c300, 1, 'amount_paid_cents'), '0', 'P1 revertida');
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'amount_paid_cents'), '0', 'P2 revertida');
    perform pg_temp.eq(public._inv_credit_balance(L)::text, '0', 'saldo a favor 0');
    perform pg_temp.eq((select status from public.payments where id = pid), 'anulado', 'pago anulado');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== extra: devolución total
  t_n := 21; t_name := 'Devolución total + cuotas pagadas → aporte y línea liquidados, sin cuotas nuevas';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-02-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    perform public._inv_register_payment(I, L, 3000, '2026-02-20 09:00-05', 'yape');            -- P1
    perform public._inv_register_payment(I, L, 30000, '2026-02-20 10:00-05', 'transferencia', 'capital');
    perform pg_temp.eq(pg_temp.sched(c300, 2, 'amount_due_cents'), '3000', 'P2 se debe completa (periodo_completo)');
    perform pg_temp.eq((select status from public.contributions where id = c300), 'activo', 'aún activo');
    perform public._inv_register_payment(I, L, 3000, '2026-02-20 11:00-05', 'yape');            -- P2
    perform pg_temp.eq((select status from public.contributions where id = c300), 'liquidado', 'aporte liquidado');
    perform pg_temp.eq((select status from public.investment_lines where id = L), 'liquidada', 'línea liquidada');
    perform pg_temp.today('2026-04-01');
    perform public._inv_ensure_schedules(L);
    perform pg_temp.eq((select count(*) from public.interest_schedules where contribution_id = c300)::text, '2', 'sin cuotas nuevas');
    perform public._inv_close_line(I, L, 'Terminamos');
    perform pg_temp.eq((select status from public.investment_lines where id = L), 'cerrada', 'línea cerrada');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== extra: nada se borra
  t_n := 22; t_name := 'Nada se borra: DELETE bloqueado y auditoría registrada';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');
    begin
      delete from public.contributions where id = c300;
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like '%no se borran%' then raise exception 'FAIL [delete]: %', sqlerrm; end if;
    end;
    perform pg_temp.eq((select actor::text from public.audit_log where table_name = 'contributions' and record_id = c300 and action = 'INSERT'), I::text, 'auditoría con actor');
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;

  -- =================================================================== RLS
  t_n := 30; t_name := 'RLS: el gestor B no ve la línea del gestor A; el gestor no cambia tasas; sin escritura directa';
  begin
    perform pg_temp.mk_user(I, 'test-inv@finwat.test');
    perform pg_temp.mk_user(M1, 'test-m1@finwat.test');
    perform pg_temp.mk_user(M2, 'test-m2@finwat.test');
    perform pg_temp.today('2026-03-20');
    L := public._inv_create_line(I, 'Juan', null, 'PEN', 500000, 0.10);
    L2 := public._inv_create_line(I, 'Rosa', null, 'PEN', 300000, 0.10);
    update public.investment_lines set manager_user_id = M1 where id = L;
    update public.investment_lines set manager_user_id = M2 where id = L2;
    c300 := pg_temp.contrib(I, L, 30000, '2026-01-15');

    -- gestor B
    perform set_config('request.jwt.claims', json_build_object('sub', M2, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    n := (select count(*) from public.investment_lines);
    v := (select count(*) from public.contributions where line_id = L)::text;
    execute 'reset role';
    perform pg_temp.eq(n::text, '1', 'gestor B ve solo su línea');
    perform pg_temp.eq(v, '0', 'gestor B no ve aportes de A');

    -- gestor A ve su línea y sus cuotas
    perform set_config('request.jwt.claims', json_build_object('sub', M1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    n := (select count(*) from public.interest_schedules_view where line_id = L);
    execute 'reset role';
    perform pg_temp.eq((n > 0)::text, 'true', 'gestor A ve cuotas de su línea');

    -- gestor A no puede escribir directo
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', M1, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      insert into public.contributions (line_id, amount_cents, contributed_at, anchor_day, monthly_rate, created_by)
      values (L, 100, '2026-03-01', 1, 0.1, M1);
      raise exception 'no lanzó error';
    exception when others then
      if sqlstate <> '42501' then raise exception 'FAIL [insert directo]: % %', sqlstate, sqlerrm; end if;
    end;

    -- gestor no cambia tasas ni registra aportes
    begin
      perform public._inv_change_rate(M1, 0.05, 'intento', c300, 1);
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like 'Solo el inversionista%' then raise exception 'FAIL [tasa gestor]: %', sqlerrm; end if;
    end;
    begin
      perform public._inv_register_contribution(M1, L, 1000, '2026-03-01');
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like 'Solo el inversionista%' then raise exception 'FAIL [aporte gestor]: %', sqlerrm; end if;
    end;

    -- wrapper público: el gestor B no puede pedir el resumen de la línea A
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', M2, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      perform public.line_summary(L);
      raise exception 'no lanzó error';
    exception when others then
      if sqlerrm not like 'No tienes acceso%' then raise exception 'FAIL [line_summary ajeno]: %', sqlerrm; end if;
    end;

    -- el inversionista sí, vía wrapper
    perform set_config('request.jwt.claims', json_build_object('sub', I, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    r := public.line_summary(L);
    execute 'reset role';
    perform pg_temp.eq(r ->> 'role', 'investor', 'inversionista ve su resumen');

    -- anon no ve nada
    begin
      perform set_config('request.jwt.claims', '', true);
      execute 'set local role anon';
      perform count(*) from public.investment_lines;
      raise exception 'no lanzó error';
    exception when others then
      if sqlstate <> '42501' then raise exception 'FAIL [anon]: % %', sqlstate, sqlerrm; end if;
    end;
    raise exception 'PASS';
  exception when others then
    insert into inv_test_results values (t_n, t_name, sqlerrm = 'PASS', nullif(sqlerrm, 'PASS'));
  end;
end
$tests$;

select n, case when ok then 'PASS' else 'FAIL' end as resultado, name as test, detail as detalle
from inv_test_results order by n;
