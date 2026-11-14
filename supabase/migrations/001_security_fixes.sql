-- =====================================================================================
-- 001_security_fixes.sql — PROPUESTA (no aplicada en ningún lado todavía)
-- =====================================================================================
-- Hallazgos de la revisión de producción del 2026-11-13. Se aplica en el único proyecto
-- (tcltpyhxxgmwlhvztuba) solo después de que el usuario lo apruebe.
-- Idempotente.
-- =====================================================================================

-- 1) reminders: "Service role can update reminders" es para el rol `public` con using(true).
--    `public` incluye anon y authenticated: cualquiera con la anon key (que va en el
--    frontend) puede hacer UPDATE sobre recordatorios ajenos. El bot usa la service key,
--    que ya salta RLS, así que la policy no le sirve a nadie.
drop policy if exists "Service role can update reminders" on public.reminders;

-- 2) profiles: no hay policy de INSERT, así que ensureProfile() de la app
--    (src/api/authService.ts) falla siempre con error de RLS cuando falta el perfil.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- 3) search_path fijo en funciones (advisor 0011). Todas usan tablas de public.
alter function public.update_updated_at()       set search_path = public;
alter function public.set_updated_at()          set search_path = public;
alter function public.sync_account_balance()    set search_path = public;
alter function public.create_profile_on_signup() set search_path = public;
alter function public.create_default_account()  set search_path = public;

-- 4) Funciones de trigger SECURITY DEFINER expuestas como RPC (advisors 0028/0029).
--    Los triggers siguen funcionando: EXECUTE solo se verifica al crear el trigger.
revoke execute on function public.sync_account_balance()     from public, anon, authenticated;
revoke execute on function public.create_profile_on_signup() from public, anon, authenticated;
revoke execute on function public.create_default_account()   from public, anon, authenticated;

-- Pendiente aparte (se cambia en el Dashboard, no por SQL):
-- Authentication → Providers → Email → activar "Leaked password protection".
