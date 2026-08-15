-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #114：yili_corpus 语料库 RLS 泄露
-- 2026-08-14
--
-- 问题：yili_corpus 未启用 RLS，却 grant select 给 anon/authenticated，
--       任何匿名访客可用 Supabase REST API 全量拉取依力课程语料。
-- 修复：
--   1. 撤销 anon/authenticated 的 SELECT 权限（get_yili_samples 是
--      security definer，不受影响，服务端仍可正常检索）
--   2. 启用 RLS 并只放行服务端路径（service_role 走 bypassrls）
--   3. 收紧 get_yili_samples 的执行权限：仅 authenticated（登录用户）
-- ═══════════════════════════════════════════════

-- 1. 撤销匿名/登录用户的表级 SELECT（关键修复）
revoke select on public.yili_corpus from anon, authenticated;

-- 2. 启用 RLS（service_role 自动绕过，不影响服务端写入）
alter table public.yili_corpus enable row level security;

-- 3. 清理可能存在的旧策略后，建一个仅 service_role 可用的策略
--    （实际上 service_role 绕过 RLS，此策略只是显式声明意图；
--     登录用户的读只能走 get_yili_samples RPC，不再直查表）
do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'yili_corpus' loop
    execute format('drop policy if exists %I on public.yili_corpus', r.policyname);
  end loop;
end $$;

create policy "yili_corpus_service_only" on public.yili_corpus
  for select
  using (auth.role() = 'service_role');

-- 4. get_yili_samples 收紧：撤销 anon，仅保留 authenticated + service_role
revoke execute on function public.get_yili_samples(text, text[], vector, int) from anon;
grant execute on function public.get_yili_samples(text, text[], vector, int) to authenticated, service_role;

-- ═══ 验证 ═══
-- 1. 未登录（anon）直接查表应报 permission denied：
--    select * from public.yili_corpus limit 1;   -- ❌ 拒绝
-- 2. 已登录用户调用 RPC 正常：
--    select public.get_yili_samples('python', array['python'], null, 3);  -- ✅
-- 3. anon 调 RPC 应被拒：
--    （匿名客户端调用 get_yili_samples → permission denied for function）

-- 回滚：
--   grant select on public.yili_corpus to anon, authenticated;
--   alter table public.yili_corpus disable row level security;
--   grant execute on function public.get_yili_samples(text, text[], vector, int) to anon;
