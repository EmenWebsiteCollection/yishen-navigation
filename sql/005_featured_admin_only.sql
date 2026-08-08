-- ============================================================================
-- 005_featured_admin_only.sql
-- Issue #50：编辑精选权限限制
--
-- 背景：任何登录用户都能通过 works_update_own RLS 策略直接 UPDATE 自己的
--       works 行，把 featured 列改成 true（绕过 set_featured RPC 的管理员校验）。
--
-- 修复（本文件）：
--   1. 列级 REVOKE：authenticated / anon 一律失去对 works.featured 列的
--      UPDATE 权限。普通用户即使直接 .update({ featured: true }) 也会报
--      "permission denied for column featured"，RLS 层面彻底封死。
--   2. 唯一写入通道 = set_featured RPC（002_discovery.sql 已定义，
--      SECURITY DEFINER + is_admin() 校验，函数 owner 不受列权限限制）。
--
-- 依赖：002_discovery.sql 已执行（set_featured 存在）。
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行。幂等。
-- 验证：
--   select has_column_privilege('authenticated', 'public.works', 'featured', 'UPDATE');
--   -- 期望 false
-- ============================================================================

revoke update (featured) on public.works from authenticated, anon;

-- 保险：确认 set_featured 的授权还在（普通用户需要能调用它，内部会再校验管理员）
grant execute on function public.set_featured(uuid, boolean) to authenticated;

-- 完成。验证：
--   select has_column_privilege('authenticated', 'public.works', 'featured', 'UPDATE');  -- false
--   select has_column_privilege('anon', 'public.works', 'featured', 'UPDATE');           -- false
