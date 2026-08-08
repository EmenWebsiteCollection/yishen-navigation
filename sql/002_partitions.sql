-- ============================================================================
-- 002_partitions.sql
-- 依门（yishen-navigation）第二阶段：首页可动态添加的「分区」
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 说明：
--   1. 分区表全局共享，所有访客可读；登录用户可创建，创建者可改名/删除。
--   2. 每个分区对应一个 work_type，作品在创建/编辑时选择分区。
--   3. 分区数量可随时增加，不影响已有作品。
-- ============================================================================

create table if not exists public.partitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  work_type text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partitions_name_unique unique (name),
  constraint partitions_work_type_unique unique (work_type)
);

alter table public.partitions enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'partitions' loop
    execute format('drop policy if exists %I on public.partitions', r.policyname);
  end loop;
end $$;

create policy "partitions_select_all" on public.partitions
  for select using (true);

create policy "partitions_insert_auth" on public.partitions
  for insert with check (
    auth.role() = 'authenticated'
    and not coalesce(((auth.jwt() -> 'app_metadata'::text) ->> 'is_anonymous'::text)::boolean, false)
    and created_by = auth.uid()
  );

create policy "partitions_update_own" on public.partitions
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "partitions_delete_own" on public.partitions
  for delete using (created_by = auth.uid());

-- 默认分区：与 works.work_type 现有类型保持一致
insert into public.partitions (name, work_type, sort_order) values
  ('网站', 'website', 10),
  ('小说', 'novel', 20),
  ('插画', 'illustration', 30),
  ('游戏', 'game', 40),
  ('音乐', 'music', 50),
  ('视频', 'video', 60),
  ('摄影', 'photo', 70),
  ('其他', 'other', 80)
on conflict (name) do nothing;

grant select on public.partitions to anon, authenticated;
grant insert, update, delete on public.partitions to authenticated;

-- ============================================================================
-- 完成。执行后首页分区即可启用；未执行时前端会自动降级为默认分区。
-- ============================================================================
