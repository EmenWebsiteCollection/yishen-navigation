-- ============================================================================
-- 20260808_add_idea_camp.sql
-- Issue #12「想法集中营」：想法发布 / 点赞(一人一票) / 收藏(=关注) / 评论 /
-- 进展时间线 / 想法→作品孵化闭环
--
-- 执行方式：Supabase SQL Editor 或管理 API 执行（幂等，可重复执行）
-- 涉及：
--   1. works.source_idea_id（作品孵化自哪个想法）
--   2. ideas / idea_votes / idea_favorites / idea_comments / idea_updates
--   3. ideas_with_stats 视图（security_invoker，随查询者身份应用 RLS）
--   4. get_creator_stats 扩展（想法数 / 想法获赞 / 已实现数）
--   5. merge_ideas 管理员合并函数（防刷票 + 重复想法分裂票数）
-- ============================================================================

-- ---------- 1. works.source_idea_id ----------
alter table public.works add column if not exists source_idea_id uuid;

-- ---------- 2. ideas 表 ----------
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'other',
  tags text[] not null default '{}',
  status text not null default 'idea',
  related_work_id uuid references public.works(id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ideas_status_check' and conrelid = 'public.ideas'::regclass
  ) then
    alter table public.ideas add constraint ideas_status_check check (status in ('idea','developing','done','closed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'ideas_category_check' and conrelid = 'public.ideas'::regclass
  ) then
    alter table public.ideas add constraint ideas_category_check check (category in ('website','tool','ai','game','illustration','writing','community','other'));
  end if;
end $$;

create index if not exists ideas_user_id_idx on public.ideas (user_id);
create index if not exists ideas_status_idx on public.ideas (status);
create index if not exists ideas_title_lower_idx on public.ideas (lower(title));

drop trigger if exists ideas_set_updated_at on public.ideas;
create trigger ideas_set_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

-- ---------- 3. 互动表 ----------
create table if not exists public.idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint idea_votes_unique unique (idea_id, user_id)
);

create table if not exists public.idea_favorites (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint idea_favorites_unique unique (idea_id, user_id)
);

create table if not exists public.idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  parent_id uuid references public.idea_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.idea_updates (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'progress',
  content text not null,
  created_at timestamptz not null default now(),
  constraint idea_updates_kind_check check (kind in ('status','progress','merge'))
);

create index if not exists idea_votes_idea_id_idx on public.idea_votes (idea_id);
create index if not exists idea_favorites_idea_id_idx on public.idea_favorites (idea_id);
create index if not exists idea_comments_idea_id_idx on public.idea_comments (idea_id);
create index if not exists idea_updates_idea_id_idx on public.idea_updates (idea_id);

-- ---------- 4. RLS ----------
alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.idea_favorites enable row level security;
alter table public.idea_comments enable row level security;
alter table public.idea_updates enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('ideas','idea_votes','idea_favorites','idea_comments','idea_updates')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ideas：公开可读；本人可写（非匿名）；管理员兜底
create policy "ideas_select_public" on public.ideas for select using (true);
create policy "ideas_insert_own" on public.ideas for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "ideas_update_own" on public.ideas for update using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());
create policy "ideas_delete_own" on public.ideas for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- idea_votes：公开读；本人投/撤（一人一票由唯一约束兜底）
create policy "idea_votes_select_public" on public.idea_votes for select using (true);
create policy "idea_votes_insert_own" on public.idea_votes for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "idea_votes_delete_own" on public.idea_votes for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- idea_favorites：收藏=关注，私密（仅本人可见列表）
create policy "idea_favorites_select_own" on public.idea_favorites for select using (auth.uid() = user_id);
create policy "idea_favorites_insert_own" on public.idea_favorites for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "idea_favorites_delete_own" on public.idea_favorites for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- idea_comments：公开读；本人写；本人或管理员删
create policy "idea_comments_select_public" on public.idea_comments for select using (true);
create policy "idea_comments_insert_own" on public.idea_comments for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "idea_comments_delete_own" on public.idea_comments for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- idea_updates：进展/状态时间线，公开读；操作者写（作者/管理员经服务层写入，user_id=操作者）
create policy "idea_updates_select_public" on public.idea_updates for select using (true);
create policy "idea_updates_insert_own" on public.idea_updates for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "idea_updates_delete_own" on public.idea_updates for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- ---------- 5. ideas_with_stats 视图 ----------
drop view if exists public.ideas_with_stats;

create view public.ideas_with_stats
with (security_invoker = true) as
select
  i.id,
  i.user_id,
  i.title,
  i.description,
  i.category,
  i.tags,
  i.status,
  i.related_work_id,
  i.pinned,
  i.created_at,
  i.updated_at,
  p.username,
  p.avatar_url,
  (select count(*)::int from public.idea_votes v where v.idea_id = i.id) as vote_count,
  (select count(*)::int from public.idea_comments c where c.idea_id = i.id) as comment_count,
  (select count(*)::int from public.idea_favorites f where f.idea_id = i.id) as favorite_count,
  w.title as related_work_title,
  w.url as related_work_url,
  w.work_type as related_work_type
from public.ideas i
left join public.profiles p on p.id = i.user_id
left join public.works w on w.id = i.related_work_id;

-- ---------- 6. 授权（security_invoker 视图要求底层表对 anon 有 SELECT） ----------
grant select on public.ideas, public.idea_votes, public.idea_favorites, public.idea_comments, public.idea_updates to anon, authenticated;
grant insert, update, delete on public.ideas to authenticated;
grant insert, delete on public.idea_votes, public.idea_favorites to authenticated;
grant insert, delete on public.idea_comments, public.idea_updates to authenticated;
grant select on public.ideas_with_stats to anon, authenticated;

-- ---------- 7. get_creator_stats 扩展（创作者主页：想法数 / 想法获赞 / 已实现数） ----------
create or replace function public.get_creator_stats(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'work_count',
      (select count(*)::int from public.works w
        where w.user_id = p_user_id and w.visibility = 'public'),
    'like_count',
      (select coalesce(sum(c), 0)::int from (
         select count(*)::int as c
         from public.website_likes l
         join public.works w on w.id = l.website_id
         where w.user_id = p_user_id and w.visibility = 'public'
         group by w.id
       ) t),
    'favorite_count',
      (select count(*)::int from public.favorites f
        join public.works w on w.id = f.work_id
        where w.user_id = p_user_id and w.visibility = 'public'),
    'comment_count',
      (select count(*)::int from public.comments c
        join public.works w on w.id = c.website_id
        where w.user_id = p_user_id and w.visibility = 'public'),
    'idea_count',
      (select count(*)::int from public.ideas i
        where i.user_id = p_user_id),
    'idea_vote_count',
      (select coalesce(sum(c), 0)::int from (
         select count(*)::int as c
         from public.idea_votes v
         join public.ideas i on i.id = v.idea_id
         where i.user_id = p_user_id
         group by i.id
       ) t),
    'idea_done_count',
      (select count(*)::int from public.ideas i
        where i.user_id = p_user_id and i.status = 'done')
  );
$$;

grant execute on function public.get_creator_stats(uuid) to anon, authenticated;

-- ---------- 8. 管理员合并函数（重复想法防分裂：投票去重转移、评论转移、双端留痕） ----------
create or replace function public.merge_ideas(p_target_id uuid, p_source_ids uuid[], p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_title text;
  v_moved int := 0;
  v_source record;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and is_admin) then
    raise exception '需要管理员权限才能合并想法';
  end if;

  select title into v_target_title from public.ideas where id = p_target_id;
  if v_target_title is null then
    raise exception '目标想法不存在';
  end if;

  if p_source_ids is null or cardinality(p_source_ids) = 0 then
    raise exception '至少需要一个源想法';
  end if;

  -- 转移投票（唯一约束去重，同人重复票自动忽略）
  insert into public.idea_votes (idea_id, user_id, created_at)
  select p_target_id, v.user_id, v.created_at
  from public.idea_votes v
  where v.idea_id = any(p_source_ids)
  on conflict (idea_id, user_id) do nothing;
  get diagnostics v_moved = row_count;

  -- 转移评论（连带回复）
  update public.idea_comments
  set idea_id = p_target_id
  where idea_id = any(p_source_ids);

  -- 源想法关闭并留痕
  for v_source in
    select id, title from public.ideas where id = any(p_source_ids)
  loop
    update public.ideas set status = 'closed', related_work_id = null where id = v_source.id;
    insert into public.idea_updates (idea_id, user_id, kind, content)
    values (v_source.id, p_admin_id, 'merge', '已并入「' || v_target_title || '」，投票与评论已合并');
  end loop;

  -- 目标想法留痕
  insert into public.idea_updates (idea_id, user_id, kind, content)
  values (p_target_id, p_admin_id, 'merge', '已合并 ' || v_moved || ' 条投票');
end;
$$;

grant execute on function public.merge_ideas(uuid, uuid[], uuid) to authenticated;
