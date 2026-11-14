-- =====================================================================================
-- 015_vouchers_storage.sql — Bucket privado de vouchers
-- =====================================================================================
-- Ruta: investment-vouchers/{line_id}/{archivo}. Solo los miembros de la línea leen y
-- suben; nadie edita ni borra (no hay policies de UPDATE/DELETE). Lectura con signed URLs.
-- Imágenes (comprimidas en el cliente) o PDF, máx. 10 MB.
-- Idempotente.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('investment-vouchers', 'investment-vouchers', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create or replace function public.inv_try_uuid(p text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.inv_try_uuid(text) from public, anon;
grant  execute on function public.inv_try_uuid(text) to authenticated, service_role;

drop policy if exists "inv_vouchers_select" on storage.objects;
create policy "inv_vouchers_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'investment-vouchers'
         and public.inv_is_line_member(public.inv_try_uuid((storage.foldername(name))[1])));

drop policy if exists "inv_vouchers_insert" on storage.objects;
create policy "inv_vouchers_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'investment-vouchers'
              and public.inv_is_line_member(public.inv_try_uuid((storage.foldername(name))[1])));
