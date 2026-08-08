-- work_media 桶 + storage RLS（幂等，可重复执行）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work_media',
  'work_media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "work_media_public_read" on storage.objects;
create policy "work_media_public_read" on storage.objects
  for select using (bucket_id = 'work_media');

drop policy if exists "work_media_own_insert" on storage.objects;
create policy "work_media_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'work_media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "work_media_own_delete" on storage.objects;
create policy "work_media_own_delete" on storage.objects
  for delete using (
    bucket_id = 'work_media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
