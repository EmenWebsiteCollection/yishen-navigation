-- ═══════════════════════════════════════════════════════════════
-- 依神导航 · 20260808 后端安全与功能修复合辑（幂等，可重复执行）
-- 提供：数据库与后端组 2026-08-08
-- 内容：
--   1. 删除类 RPC 五件套（绕开 PostgREST DELETE 通道故障）
--   2. merge_ideas 权限修复（P0：管理员校验改 is_admin()，防冒充）
--   3. profiles 敏感列撤销 SELECT（P1：email/phone/socials/is_admin）
--   4. works INSERT 策略加 auth.role() 双保险
--   5. works_with_likes 视图重建（补 Issue#39 meta 列 + video_url）
--   6. partitions 仅管理员可增删
--   7. rpc_delete_idea_comment / rpc_increment_idea_vote
--   8. 索引补充 + source_idea_id 外键
-- ═══════════════════════════════════════════════════════════════

-- ---------- 1. 删除类 RPC（SECURITY DEFINER，本人或管理员） ----------
create or replace function public.rpc_delete_website(website_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.works where id = website_id;
  if owner_id is null then raise exception '作品不存在'; end if;
  if auth.uid() <> owner_id and not public.is_admin() then
    raise exception '您没有权限删除此作品';
  end if;
  delete from public.works where id = website_id;
end $$;
grant execute on function public.rpc_delete_website(uuid) to authenticated;

create or replace function public.rpc_delete_comment(comment_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.comments where id = comment_id;
  if owner_id is null then raise exception '评论不存在'; end if;
  if auth.uid() <> owner_id and not public.is_admin() then
    raise exception '您没有权限删除此评论';
  end if;
  delete from public.comments where id = comment_id;
end $$;
grant execute on function public.rpc_delete_comment(uuid) to authenticated;

create or replace function public.rpc_unlike(target_website_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.website_likes
  where website_id = target_website_id and user_id = auth.uid();
end $$;
grant execute on function public.rpc_unlike(uuid) to authenticated;

create or replace function public.rpc_unfavorite(target_work_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.favorites
  where work_id = target_work_id and user_id = auth.uid();
end $$;
grant execute on function public.rpc_unfavorite(uuid) to authenticated;

create or replace function public.rpc_delete_group(target_group_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.groups where id = target_group_id and user_id = auth.uid();
end $$;
grant execute on function public.rpc_delete_group(uuid) to authenticated;

create or replace function public.rpc_delete_idea_comment(comment_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.idea_comments where id = comment_id;
  if owner_id is null then raise exception '评论不存在'; end if;
  if auth.uid() <> owner_id and not public.is_admin() then
    raise exception '您没有权限删除此评论';
  end if;
  delete from public.idea_comments where id = comment_id;
end $$;
grant execute on function public.rpc_delete_idea_comment(uuid) to authenticated;

-- ---------- 2. merge_ideas 权限修复（P0） ----------
create or replace function public.merge_ideas(p_target_id uuid, p_source_ids uuid[], p_admin_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_target_title text;
  v_source record;
begin
  -- 管理员身份由 auth.uid() 决定，p_admin_id 参数不再信任（仅保留签名兼容前端）
  if not public.is_admin() then
    raise exception '需要管理员权限才能合并想法';
  end if;

  select title into v_target_title from public.ideas where id = p_target_id;
  if v_target_title is null then
    raise exception '目标想法不存在';
  end if;

  if p_source_ids is null or cardinality(p_source_ids) = 0 then
    raise exception '至少需要一个源想法';
  end if;

  insert into public.idea_votes (idea_id, user_id, created_at)
  select p_target_id, v.user_id, v.created_at
  from public.idea_votes v
  where v.idea_id = any(p_source_ids)
  on conflict (idea_id, user_id) do nothing;

  update public.idea_comments
  set idea_id = p_target_id
  where idea_id = any(p_source_ids);

  for v_source in
    select id, title from public.ideas where id = any(p_source_ids)
  loop
    update public.ideas set status = 'closed', related_work_id = null where id = v_source.id;
    insert into public.idea_updates (idea_id, user_id, kind, content)
    values (v_source.id, auth.uid(), 'merge', '已并入「' || v_target_title || '」，投票与评论已合并');
  end loop;
end $$;

-- ---------- 3. profiles 敏感列撤销（P1） ----------
-- 注意：仅列级 REVOKE 会被 Supabase 平台默认权限还原，必须表级 REVOKE + 列级 GRANT 白名单
revoke select on public.profiles from anon, authenticated;
grant select (
  id, username, avatar_url, bio, cover_url, expertise, tools, style_tags,
  current_project, creation_progress, collab_status, commission_status,
  services, socials, website_link, accent_color, bg_color, created_at, updated_at
) on public.profiles to anon, authenticated;

-- ---------- 4. works INSERT 双保险 ----------
drop policy if exists works_insert_own on public.works;
create policy works_insert_own on public.works
  for insert
  with check (
    (auth.role() = 'authenticated'::text)
    and (auth.uid() = user_id)
    and (not coalesce((((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text))::boolean, false))
  );

-- ---------- 5. works_with_likes 视图（meta 列 + video_url） ----------
drop view if exists public.works_with_likes;
create view public.works_with_likes
with (security_invoker = true) as
select
  w.id, w.url, w.title, w.description, w.image_url, w.cover_url, w.media_url,
  w.work_type, w.featured, w.status, w.visibility, w.group_id, w.changelog,
  w.tags, w.styles, w.tools, w.creative_type, w.completion, w.seeking_collab,
  w.derivative_allowed, w.commercial_use, w.ai_degree, w.audience, w.content_warning,
  w.created_at, w.updated_at, w.user_id, w.view_count, w.source_idea_id, w.video_url,
  (select count(*)::int from public.website_likes l where l.website_id = w.id) as like_count,
  p.username, p.avatar_url
from public.works w
left join public.profiles p on p.id = w.user_id;
grant select on public.works_with_likes to anon, authenticated;

-- ---------- 6. partitions 仅管理员 ----------
drop policy if exists partitions_insert_auth on public.partitions;
drop policy if exists partitions_insert_admin on public.partitions;
create policy partitions_insert_admin on public.partitions
  for insert with check (public.is_admin());
drop policy if exists partitions_delete_own on public.partitions;
drop policy if exists partitions_delete_admin on public.partitions;
create policy partitions_delete_admin on public.partitions
  for delete using (public.is_admin());

-- ---------- 7. 想法投票计数 ----------
create or replace function public.rpc_increment_idea_vote(p_idea_id uuid)
returns void
language sql security definer
set search_path = public
as $$
  insert into public.idea_votes (idea_id, user_id)
  values (p_idea_id, auth.uid())
  on conflict (idea_id, user_id) do nothing;
$$;
grant execute on function public.rpc_increment_idea_vote(uuid) to anon, authenticated;

-- ---------- 8. 索引 + 外键 ----------
create index if not exists idx_works_user_id on public.works(user_id);
create index if not exists idx_works_group_id on public.works(group_id);
create index if not exists idx_works_source_idea_id on public.works(source_idea_id);
create index if not exists idx_comments_user_id on public.comments(user_id);

alter table public.works drop constraint if exists works_source_idea_fk;
alter table public.works
  add constraint works_source_idea_fk foreign key (source_idea_id)
  references public.ideas(id) on delete set null;

-- ═══ 验证 ═══
-- select proname from pg_proc where proname like 'rpc_%' order by proname;
-- select * from pg_policies where schemaname='public' and tablename='partitions';

-- ---------- 9. comments UPDATE 策略（反馈闭环：作者/管理员标记 feedback_status） ----------
drop policy if exists comments_update_own_or_admin on public.comments;
create policy comments_update_own_or_admin on public.comments
  for update
  using ((auth.uid() = user_id) or public.is_admin())
  with check ((auth.uid() = user_id) or public.is_admin());
