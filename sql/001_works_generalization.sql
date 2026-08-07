-- ============================================================================
-- 001_works_generalization.sql
-- 依门（yishen-navigation）第一阶段：works 泛化 + 创作者档案 + 收藏/分组
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行，不会报错（除个别依赖人工确认的项，见下方注意事项）。
--
-- 注意事项：
--   1. 执行后原 websites 表更名为 works；仓库代码同步切换到 works。
--   2. 若执行过程中任何一步报错，请把完整错误信息发回，我会给修复脚本。
--   3. 历史数据：若 works.url 存在重复值，唯一索引可能无法建立，届时单独处理。
--   4. website_likes / comments.website_id 命名本次保留（避免破坏既有策略），
--      后续可另开迁移统一为 work 命名。
--   5. 管理员 RLS 覆盖未实现（当前项目尚无管理端模块）；需要时再追加。
-- ============================================================================

-- ---------- 1. websites -> works ----------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'websites'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'works'
  ) then
    alter table public.websites rename to works;
  end if;
end $$;

-- 兼容只读视图：避免遗漏的旧引用（如历史 SQL/报表）直接报错；代码已全部迁移到 works
drop view if exists public.websites;
create view public.websites as select * from public.works;

-- ---------- 2. works 新列 ----------
alter table public.works add column if not exists work_type text not null default 'website';
alter table public.works add column if not exists featured boolean not null default false;
alter table public.works add column if not exists cover_url text;
alter table public.works add column if not exists status text;
alter table public.works add column if not exists visibility text not null default 'public';
alter table public.works add column if not exists group_id uuid;
alter table public.works add column if not exists changelog text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'works_visibility_check' and conrelid = 'public.works'::regclass
  ) then
    alter table public.works add constraint works_visibility_check check (visibility in ('public','private'));
  end if;
end $$;

-- URL 唯一性：原 websites_url_key 已随表重命名保留（唯一约束允许多个 NULL，
-- 非网站类作品 url 为 NULL，互不冲突），无需额外处理。

-- ---------- 3. groups 表 ----------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint groups_user_name_unique unique (user_id, name)
);

alter table public.groups enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'groups' loop
    execute format('drop policy if exists %I on public.groups', r.policyname);
  end loop;
end $$;

create policy "groups_select_own" on public.groups for select using (auth.uid() = user_id);
create policy "groups_insert_own" on public.groups for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "groups_update_own" on public.groups for update using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());
create policy "groups_delete_own" on public.groups for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- works.group_id 外键：删除分组后，作品归入「未分组」
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'works_group_id_fkey' and conrelid = 'public.works'::regclass
  ) then
    alter table public.works
      add constraint works_group_id_fkey
      foreign key (group_id) references public.groups(id) on delete set null;
  end if;
end $$;

-- ---------- 4. favorites 表 ----------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_work_user_unique unique (work_id, user_id)
);

alter table public.favorites enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'favorites' loop
    execute format('drop policy if exists %I on public.favorites', r.policyname);
  end loop;
end $$;

create policy "favorites_select_own" on public.favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "favorites_delete_own" on public.favorites for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- ---------- 5. profiles 扩展（创作者档案） ----------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists expertise text[] not null default '{}';
alter table public.profiles add column if not exists tools text[] not null default '{}';
alter table public.profiles add column if not exists style_tags text[] not null default '{}';
alter table public.profiles add column if not exists current_project text;
alter table public.profiles add column if not exists creation_progress integer not null default 0;
alter table public.profiles add column if not exists collab_status text not null default 'open';
alter table public.profiles add column if not exists commission_status text not null default 'open';
alter table public.profiles add column if not exists services text;
alter table public.profiles add column if not exists socials jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists website_link text;
alter table public.profiles add column if not exists bg_color text;
alter table public.profiles add column if not exists accent_color text;
alter table public.profiles add column if not exists updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_collab_status_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_collab_status_check check (collab_status in ('open','limited','closed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_commission_status_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_commission_status_check check (commission_status in ('open','closed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_creation_progress_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_creation_progress_check check (creation_progress between 0 and 100);
  end if;
end $$;

-- profiles RLS：所有人可读；仅本人可改（管理员后续按需追加）
alter table public.profiles enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', r.policyname);
  end loop;
end $$;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id or is_admin());

-- ---------- 6. works RLS ----------
alter table public.works enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'works' loop
    execute format('drop policy if exists %I on public.works', r.policyname);
  end loop;
end $$;

create policy "works_select_public_or_owner" on public.works
  for select using (visibility = 'public' or auth.uid() = user_id or is_admin());
create policy "works_insert_own" on public.works
  for insert with check (auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false));
create policy "works_update_own" on public.works
  for update using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());
create policy "works_delete_own" on public.works
  for delete using ((auth.uid() = user_id and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)) or is_admin());

-- ---------- 7. 视图 works_with_likes（security_invoker：随查询者身份应用 RLS） ----------
drop view if exists public.websites_with_likes;
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
  w.work_type,
  w.featured,
  w.status,
  w.visibility,
  w.group_id,
  w.changelog,
  w.created_at,
  w.updated_at,
  w.user_id,
  (select count(*)::int from public.website_likes l where l.website_id = w.id) as like_count,
  p.username,
  p.avatar_url
from public.works w
left join public.profiles p on p.id = w.user_id;

-- ---------- 8. 统计函数（SECURITY DEFINER：只暴露聚合数字，不泄露明细） ----------
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
        where w.user_id = p_user_id and w.visibility = 'public')
  );
$$;

grant execute on function public.get_creator_stats(uuid) to anon, authenticated;

create or replace function public.get_work_favorite_count(p_work_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*) from public.favorites where work_id = p_work_id;
$$;

grant execute on function public.get_work_favorite_count(uuid) to anon, authenticated;

-- ---------- 9. 存储桶（头像 avatars / 封面 covers，公开读、本人写） ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('avatars_read','avatars_write','avatars_update','avatars_delete',
                         'covers_read','covers_write','covers_update','covers_delete')
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "avatars_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_write" on storage.objects for insert with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy "avatars_update" on storage.objects for update using (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy "avatars_delete" on storage.objects for delete using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

create policy "covers_read" on storage.objects for select using (bucket_id = 'covers');
create policy "covers_write" on storage.objects for insert with check (bucket_id = 'covers' and owner_id = auth.uid()::text);
create policy "covers_update" on storage.objects for update using (bucket_id = 'covers' and owner_id = auth.uid()::text);
create policy "covers_delete" on storage.objects for delete using (bucket_id = 'covers' and owner_id = auth.uid()::text);

-- ============================================================================
-- 完成。执行后建议运行 sql/000_diagnose.sql 检查结果。
-- ============================================================================

-- ---------- 10. 显式授权（security_invoker 视图要求查询者对底层表有 SELECT） ----------
grant select on public.works, public.profiles, public.website_likes, public.comments, public.favorites, public.groups to anon, authenticated;
grant insert, update, delete on public.works, public.favorites, public.groups to authenticated;
grant select on public.works_with_likes to anon, authenticated;