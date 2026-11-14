# Migraciones de Supabase (Finwat)

Hasta el 2026-11-13 el SQL se aplicaba a mano y sin registro. Desde ahora todo cambio de
base de datos pasa por esta carpeta.

## Un solo proyecto

Finwat usa **un único proyecto Supabase**: `tcltpyhxxgmwlhvztuba` (producción). No hay
proyecto de desarrollo (decidido 2026-11-13). Por eso:

- Cada migración se **confirma con el usuario antes de aplicarla**.
- Las migraciones de módulos nuevos son **aditivas**: crean tablas, funciones y policies
  propias y no modifican las existentes (`transactions`, `accounts`, `profiles`…), así que
  el bot y la app actuales no se ven afectados.
- Los tests se ejecutan dentro de `begin … rollback`: crean sus usuarios y datos de prueba
  dentro de la transacción y no dejan nada en la base.
- Nada de seeds persistentes en este proyecto.

## Reglas

- Archivos `NNN_nombre.sql`, numerados y **idempotentes** (`create table if not exists`,
  `create or replace function`, `drop policy if exists` antes de `create policy`,
  `drop trigger if exists` antes de `create trigger`).
- Se aplican **en orden**. Nunca se edita una migración ya aplicada: se agrega otra.
- Montos nuevos en `bigint` (céntimos). Las tablas viejas siguen en `numeric` (soles).

## Estado

| Migración | Qué hace | Aplicada |
|---|---|---|
| `000_baseline.sql` | Copia del esquema existente (2026-11-13). Referencia: **no se aplica**, ya existe. | n/a |
| `001_security_fixes.sql` | Quita policy abierta de `reminders`, INSERT en `profiles`, `search_path`, revoca RPC de triggers | **pendiente de aprobación** (toca objetos existentes) |
| `010_investments_schema.sql` | Inversiones: 7 tablas nuevas, RLS activo, sin escritura directa | pendiente |
| `011_investments_audit.sql` | `audit_log` + triggers; DELETE/TRUNCATE bloqueados | pendiente |
| `012_investments_engine.sql` | Motor de intereses (fechas ancladas, capital vigente, cuotas, saldo a favor) | pendiente |
| `013_investments_rpc.sql` | RPC de escritura/lectura (internas `_inv_*` + wrappers con `auth.uid()`) | pendiente |
| `014_investments_rls.sql` | Policies de lectura + `interest_schedules_view` | pendiente |
| `015_vouchers_storage.sql` | Bucket privado `investment-vouchers` + policies | pendiente |

**Aplicar 010–015:** pegar `../bundles/fase1_aplicar_010-015.sql` en el SQL Editor (una sola transacción).
**Probar:** pegar `../tests/fase1_tests.sql` (todo con rollback; muestra PASS/FAIL).
El bundle se regenera desde las migraciones; también se verificó en un Postgres local (PGlite) con stubs de `auth`/`storage`: 17/17 tests PASS.
