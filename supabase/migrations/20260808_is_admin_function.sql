-- ============================================================================
-- 006_is_admin_function.sql
-- 测试组复核补丁：is_admin() 函数与 profiles.is_admin 列落盘
--
-- 背景：is_admin() 被 8 个迁移文件的 policy/RPC 引用，但全仓库迁移里从未
--      定义过它（历史上是在 Supabase 控制台手动创建的）。新环境按序跑迁移
--      时，create policy ... using (is_admin()) 会因函数不存在直接报错。
--      同理 profiles.is_admin 列也从未入迁移，新环境无此列。
--
-- 本文件（幂等，可重复执行）：
--   1. 确保 profiles.is_admin 列存在（新环境兜底；线上已有则跳过）
--   2. 确保 public.is_admin() 函数存在（仅当不存在时创建，绝不覆盖线上
--      已有实现，避免行为差异）
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行。
-- ============================================================================

-- 1. profiles.is_admin 列（幂等）
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2. is_admin() 函数（仅缺失时创建；不覆盖线上已有版本）
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'is_admin' and n.nspname = 'public'
  ) then
    execute 'create function public.is_admin() returns boolean language sql security definer set search_path = public stable as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$';
  end if;
end $$;

-- 3. 授权（幂等）
grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================================
-- 完成。验证：
--   select public.is_admin();  -- 未登录/普通用户应返回 false
-- ============================================================================
