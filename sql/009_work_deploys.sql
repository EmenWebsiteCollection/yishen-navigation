-- ============================================================================
-- 20260809_add_work_deploys.sql
-- Issue #13：拖拽文件一键部署（Supabase Storage 静态托管）
--   - work_deploys 公开桶：存解压后的静态站点文件，路径 work_id/...
--   - works 新增 deploy_url / deploy_updated_at
-- 约束：仅纯静态站点（HTML/CSS/JS），不支持后端；SPA 子路由刷新 404。
-- 幂等：可重复执行。
-- ============================================================================

-- 1. 存储桶（公开读、50MB、MIME 白名单）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work_deploys',
  'work_deploys',
  true,
  52428800,
  array[
    'text/html', 'text/css', 'text/javascript', 'application/javascript',
    'application/json', 'image/png', 'image/jpeg', 'image/svg+xml',
    'image/webp', 'image/gif', 'image/x-icon', 'font/woff', 'font/woff2',
    'font/ttf', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 公开读
drop policy if exists "work_deploys_public_read" on storage.objects;
create policy "work_deploys_public_read" on storage.objects
  for select using (bucket_id = 'work_deploys');

-- 写：仅作品作者（路径第一段 = 该用户拥有的作品 id）
drop policy if exists "work_deploys_owner_insert" on storage.objects;
create policy "work_deploys_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'work_deploys'
    and auth.role() = 'authenticated'
    and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)
    and (storage.foldername(name))[1] in (
      select w.id::text from public.works w where w.user_id = auth.uid()
    )
  );

drop policy if exists "work_deploys_owner_update" on storage.objects;
create policy "work_deploys_owner_update" on storage.objects
  for update using (
    bucket_id = 'work_deploys'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.works w where w.user_id = auth.uid()
    )
  );

drop policy if exists "work_deploys_owner_delete" on storage.objects;
create policy "work_deploys_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'work_deploys'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (
      select w.id::text from public.works w where w.user_id = auth.uid()
    )
  );

-- 2. works 新列
alter table public.works add column if not exists deploy_url text;
alter table public.works add column if not exists deploy_updated_at timestamptz;

-- 3. 重建 works_with_likes 视图（补 deploy_url / deploy_updated_at，供详情页读取）
drop view if exists public.works_with_likes;

create view public.works_with_likes
with (security_invoker = true) as
select
  w.id,
  w.url,
  w.title,
  w.description,
  w.image_url,
  w.cover_url,
  w.media_url,
  w.work_type,
  w.featured,
  w.status,
  w.visibility,
  w.group_id,
  w.changelog,
  w.tags,
  w.styles,
  w.tools,
  w.creative_type,
  w.completion,
  w.seeking_collab,
  w.derivative_allowed,
  w.commercial_use,
  w.ai_degree,
  w.audience,
  w.content_warning,
  w.created_at,
  w.updated_at,
  w.user_id,
  w.view_count,
  w.source_idea_id,
  w.video_url,
  w.deploy_url,
  w.deploy_updated_at,
  (select count(*)::int from public.website_likes l where l.website_id = w.id) as like_count,
  p.username,
  p.avatar_url
from public.works w
left join public.profiles p on p.id = w.user_id;

-- ============================================================================
-- 完成。验证：
--   select id from storage.buckets where id='work_deploys';
--   select column_name from information_schema.columns
--   where table_name='works' and column_name in ('deploy_url','deploy_updated_at');
--   select column_name from information_schema.columns
--   where table_name='works_with_likes' and column_name='deploy_url';
-- ============================================================================
