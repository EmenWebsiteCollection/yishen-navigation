-- ============================================================================
-- 20260808_add_discovery.sql
-- 依门（yishen-navigation）Issue #39 第一阶段（P1）：作品发现
--   - works 泛化补全：url 可空 + 创作标签体系（tags/styles/tools/创作类型/
--     完成度/合作·二创·商用/AI参与程度/受众/内容警告/media_url）
--   - follows（关注创作者）+ work_relations（灵感地图显式关系）
--   - works_discovery 视图（security_invoker，计数走 SECURITY DEFINER 函数）
--   - 发现 rail RPC：get_discovery_rail / get_random_work / set_featured
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行。
-- ============================================================================

-- ---------- 0. 修复：url 可空（非网站类作品可无 URL） ----------
alter table public.works alter column url drop not null;

-- ---------- 1. works 创作标签体系 ----------
alter table public.works add column if not exists tags text[] not null default '{}';
alter table public.works add column if not exists styles text[] not null default '{}';
alter table public.works add column if not exists tools text[] not null default '{}';
alter table public.works add column if not exists creative_type text;
alter table public.works add column if not exists completion smallint;
alter table public.works add column if not exists seeking_collab boolean not null default false;
alter table public.works add column if not exists derivative_allowed boolean not null default true;
alter table public.works add column if not exists commercial_use boolean not null default false;
alter table public.works add column if not exists ai_degree text not null default 'unknown';
alter table public.works add column if not exists audience text;
alter table public.works add column if not exists content_warning text[] not null default '{}';
alter table public.works add column if not exists media_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'works_creative_type_check' and conrelid = 'public.works'::regclass) then
    alter table public.works add constraint works_creative_type_check
      check (creative_type in ('original','derivative','collab','commission','practice'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'works_completion_check' and conrelid = 'public.works'::regclass) then
    alter table public.works add constraint works_completion_check check (completion between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'works_ai_degree_check' and conrelid = 'public.works'::regclass) then
    alter table public.works add constraint works_ai_degree_check
      check (ai_degree in ('none','assisted','mixed','generated','unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'works_audience_check' and conrelid = 'public.works'::regclass) then
    alter table public.works add constraint works_audience_check
      check (audience in ('all','teen','adult'));
  end if;
end $$;

-- 标签/风格/工具检索索引（标签即链接、相似推荐、灵感地图自动边）
create index if not exists idx_works_tags on public.works using gin (tags);
create index if not exists idx_works_styles on public.works using gin (styles);
create index if not exists idx_works_tools on public.works using gin (tools);

-- ---------- 2. follows（关注创作者） ----------
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_pair_unique unique (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

alter table public.follows enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'follows' loop
    execute format('drop policy if exists %I on public.follows', r.policyname);
  end loop;
end $$;

create policy "follows_select_public" on public.follows for select using (true);
create policy "follows_insert_own" on public.follows for insert
  with check (auth.uid() = follower_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "follows_delete_own" on public.follows for delete
  using ((auth.uid() = follower_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_follows_following on public.follows (following_id);

-- ---------- 3. work_relations（灵感地图显式关系） ----------
create table if not exists public.work_relations (
  id uuid primary key default gen_random_uuid(),
  source_work_id uuid not null references public.works(id) on delete cascade,
  target_work_id uuid not null references public.works(id) on delete cascade,
  relation_type text not null check (relation_type in ('derivative','remix','adaptation','same_inspiration','collab')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint work_relations_pair_unique unique (source_work_id, target_work_id, relation_type),
  constraint work_relations_no_self check (source_work_id <> target_work_id)
);

alter table public.work_relations enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'work_relations' loop
    execute format('drop policy if exists %I on public.work_relations', r.policyname);
  end loop;
end $$;

create policy "work_relations_select_public" on public.work_relations for select using (true);
create policy "work_relations_insert_own" on public.work_relations for insert
  with check (
    auth.uid() = created_by
    and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)
    and (
      exists (select 1 from public.works w where w.id = source_work_id and w.user_id = auth.uid())
      or exists (select 1 from public.works w where w.id = target_work_id and w.user_id = auth.uid())
      or is_admin()
    )
  );
create policy "work_relations_delete_own" on public.work_relations for delete
  using ((auth.uid() = created_by and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

create index if not exists idx_work_relations_source on public.work_relations (source_work_id);
create index if not exists idx_work_relations_target on public.work_relations (target_work_id);

-- ---------- 4. 计数函数（SECURITY DEFINER：绕过 RLS 得到准确聚合） ----------
create or replace function public.get_work_like_count(p_work_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.website_likes where website_id = p_work_id;
$$;

create or replace function public.get_work_comment_count(p_work_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.comments where website_id = p_work_id;
$$;

grant execute on function public.get_work_like_count(uuid) to anon, authenticated;
grant execute on function public.get_work_comment_count(uuid) to anon, authenticated;
grant execute on function public.get_work_favorite_count(uuid) to anon, authenticated;

-- ---------- 5. works_discovery 视图（security_invoker） ----------
drop view if exists public.works_discovery cascade;

create view public.works_discovery
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
  (select public.get_work_like_count(w.id)) as like_count,
  (select public.get_work_comment_count(w.id)) as comment_count,
  (select public.get_work_favorite_count(w.id)) as favorite_count,
  p.username,
  p.avatar_url
from public.works w
left join public.profiles p on p.id = w.user_id;

-- ---------- 6. 发现 rail RPC ----------
create or replace function public.get_discovery_rail(
  p_rail text default 'latest',
  p_user_id uuid default null,
  p_work_id uuid default null,
  p_limit int default 12,
  p_exclude_ids uuid[] default '{}'
)
returns setof public.works_discovery
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_rail text := lower(coalesce(p_rail, 'latest'));
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_excl uuid[] := coalesce(p_exclude_ids, '{}');
  v_tags text[] := '{}';
  v_styles text[] := '{}';
  v_tools text[] := '{}';
  v_wtype text := null;
begin
  if v_rail not in ('latest','rising','featured','underrated','growing','zero_comment','similar','favorites','following') then
    v_rail := 'latest';
  end if;

  if v_rail = 'similar' and p_work_id is not null then
    select w.tags, w.styles, w.tools, w.work_type into v_tags, v_styles, v_tools, v_wtype
    from public.works w where w.id = p_work_id;
  end if;

  if v_rail = 'favorites' and p_user_id is not null then
    select coalesce(array_agg(distinct t), '{}') into v_tags from (
      select unnest(w.tags) as t from public.works w
        join public.favorites f on f.work_id = w.id
        where f.user_id = p_user_id and w.visibility = 'public' and w.tags is not null
      union
      select unnest(w.styles) as t from public.works w
        join public.favorites f on f.work_id = w.id
        where f.user_id = p_user_id and w.visibility = 'public' and w.styles is not null
      union
      select unnest(w.tools) as t from public.works w
        join public.favorites f on f.work_id = w.id
        where f.user_id = p_user_id and w.visibility = 'public' and w.tools is not null
    ) s;
  end if;

  if v_rail = 'latest' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
      order by wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'rising' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.created_at >= now() - interval '7 days' and wd.like_count >= 1
      order by wd.like_count desc, wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'featured' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl)) and wd.featured
      order by wd.updated_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'underrated' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.like_count <= 10 and (wd.favorite_count + wd.comment_count) >= 2
      order by (wd.favorite_count * 2 + wd.comment_count) desc, wd.like_count desc limit v_limit;
    return;
  end if;

  if v_rail = 'growing' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.like_count between 5 and 50 and (wd.favorite_count + wd.comment_count) >= 1
      order by (wd.favorite_count + wd.comment_count) desc, wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'zero_comment' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl)) and wd.comment_count = 0
      order by wd.like_count desc, wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'following' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and exists (select 1 from public.follows fo
          where fo.follower_id = p_user_id and fo.following_id = wd.user_id)
      order by wd.created_at desc limit v_limit;
    return;
  end if;

  if v_rail = 'similar' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl))
        and wd.id <> p_work_id
        and (
          (select count(*) from unnest(wd.tags) t where t = any(v_tags))
          + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
          + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
          + case when wd.work_type = v_wtype then 1 else 0 end
        ) > 0
      order by (
        (select count(*) from unnest(wd.tags) t where t = any(v_tags))
        + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
        + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
        + case when wd.work_type = v_wtype then 1 else 0 end
      ) desc, wd.like_count desc limit v_limit;
    return;
  end if;

  if v_rail = 'favorites' then
    return query select wd.* from public.works_discovery wd
      where wd.visibility = 'public' and not (wd.id = any(v_excl)) and wd.user_id <> p_user_id
        and (
          (select count(*) from unnest(wd.tags) t where t = any(v_tags))
          + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
          + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
        ) > 0
      order by (
        (select count(*) from unnest(wd.tags) t where t = any(v_tags))
        + (select count(*) from unnest(wd.styles) t where t = any(v_styles))
        + (select count(*) from unnest(wd.tools) t where t = any(v_tools))
      ) desc, wd.like_count desc limit v_limit;
    return;
  end if;

  return query select wd.* from public.works_discovery wd
    where wd.visibility = 'public' and not (wd.id = any(v_excl))
    order by wd.created_at desc limit v_limit;
end;
$$;

create or replace function public.get_random_work(p_min_likes int default 1)
returns setof public.works_discovery
language sql
security definer
set search_path = public
as $$
  select wd.* from public.works_discovery wd
  where wd.visibility = 'public' and wd.like_count >= p_min_likes
  order by random()
  limit 1;
$$;

-- 编辑精选（仅管理员）
create or replace function public.set_featured(p_work_id uuid, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied: admin only';
  end if;
  update public.works set featured = coalesce(p_featured, false) where id = p_work_id;
end;
$$;

-- ---------- 7. 授权 ----------
grant select on public.works_discovery to anon, authenticated;
grant select on public.follows to anon, authenticated;
grant select on public.work_relations to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant insert, delete on public.work_relations to authenticated;
grant execute on function public.get_discovery_rail(text, uuid, uuid, int, uuid[]) to anon, authenticated;
grant execute on function public.get_random_work(int) to anon, authenticated;
grant execute on function public.set_featured(uuid, boolean) to authenticated;

-- ============================================================================
-- 完成。验证：
--   select count(*) from public.works_discovery;            -- 应等于公开作品数
--   select * from public.get_discovery_rail('underrated', null, null, 5, '{}');
-- ============================================================================
