-- ============================================================================
-- 20260808_add_feedback_annotations.sql
-- 依门（yishen-navigation）Issue #39 第二阶段（P2）：结构化评论 + 作品局部批注
--   - comments 新增 feedback_type（8 种反馈类型）+ anchor（批注坐标 jsonb）
--   - 评论内容约束幂等（≤1000 字 / 换行 ≤10）
--   - work_media 存储桶（视频/音频直链上传：mp4/webm/mp3/ogg，公开读、本人写）
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行。
-- ============================================================================

-- ---------- 1. comments：反馈类型 + 批注锚点 ----------
alter table public.comments add column if not exists feedback_type text not null default 'appreciate';
alter table public.comments add column if not exists anchor jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comments_feedback_type_check' and conrelid = 'public.comments'::regclass) then
    alter table public.comments add constraint comments_feedback_type_check
      check (feedback_type in ('appreciate','suggestion','technical','plot','style','error','collab','consult'));
  end if;
end $$;

-- ---------- 2. 评论内容约束（幂等，与后端修复分支一致） ----------
alter table public.comments drop constraint if exists comments_content_check;
alter table public.comments add constraint comments_content_check check (
  char_length(content) <= 1000
  and char_length(content) - char_length(replace(content, chr(10), '')) <= 10
);

-- ---------- 3. work_media 存储桶（视频 ≤100MB / 音频 ≤30MB，MIME 白名单） ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work_media',
  'work_media',
  true,
  104857600,
  array['video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg']
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

-- ============================================================================
-- 完成。验证：
--   select column_name from information_schema.columns
--   where table_name = 'comments' and column_name in ('feedback_type','anchor');
-- ============================================================================
