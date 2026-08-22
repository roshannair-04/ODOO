-- =============================================================================
-- Storage buckets for profile photos and employee documents.
-- Run after 0001_init.sql.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- avatars: public read (they're profile photos shown app-wide), owner can write
-- files are keyed as {employee_id}/{filename} so we check the path prefix
create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = 'avatars');

create policy "avatars_owner_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_employee_id()::text
  );

create policy "avatars_owner_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_employee_id()::text
  );

-- documents: private. Owner or admin can read/write; keyed the same way.
create policy "documents_owner_or_admin_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_admin())
  );

create policy "documents_owner_or_admin_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = public.current_employee_id()::text or public.is_admin())
  );
