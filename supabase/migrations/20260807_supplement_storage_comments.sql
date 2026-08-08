-- ============================================================================
-- 依神网站汇总 · 待执行 SQL 补充包（v1.0）
-- 创建人：后端组（2026-08-07）
-- 说明：schema_security.sql 之外的补充项，等总负责批准后执行。
--       全部幂等（IF NOT EXISTS / DROP IF EXISTS），可重复执行。
-- ============================================================================

-- ============================================================================
-- 1. Storage：创建网站截图 bucket + 服务端限制 + RLS
--    解决「仅前端检查文件类型/大小，Postman 可绕过」问题
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  true,
  5242880,  -- 5MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects 的 RLS：公开读，登录用户可上传/删除自己的文件
drop policy if exists "storage_images_public_read" on storage.objects;
create policy "storage_images_public_read" on storage.objects
  for select using (bucket_id = 'screenshots');

drop policy if exists "storage_images_own_insert" on storage.objects;
create policy "storage_images_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'screenshots'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_images_own_delete" on storage.objects;
create policy "storage_images_own_delete" on storage.objects
  for delete using (
    bucket_id = 'screenshots'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 2. comments 评论约束：字数 ≤ 1000，换行 ≤ 10 行（数据库层强制）
-- ============================================================================
alter table public.comments
  drop constraint if exists comments_content_check;

alter table public.comments
  add constraint comments_content_check check (
    char_length(content) <= 1000
    and char_length(content) - char_length(replace(content, chr(10), '')) <= 10
  );

-- ============================================================================
-- 3. 设置管理员（把「管理员用户名」换成实际用户名后执行）
-- ============================================================================
-- update public.profiles set is_admin = true where username = '管理员用户名';

-- ============================================================================
-- 执行后验证：
--   select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'screenshots';
--   预期：5MB 限制 + 4 种图片类型白名单
-- ============================================================================
