-- ═══════════════════════════════════════════════
-- 依神导航 · 修复「编辑主页保存失败：permission denied for table profiles」
-- 2026-08-13
--
-- 问题：从「编辑主页」保存档案时前端报
--       "保存失败：permission denied for table profiles"。
-- 根因：profiles 只有列级 SELECT 被显式授权（见 20260808_backend_security_fix.sql
--       REVOKE SELECT 后按列重授），而 authenticated 对 profiles 的
--       表级 UPDATE 权限缺失。PostgREST 执行 PATCH 需要同时满足
--       表级 GRANT 与 RLS 策略（profiles_update_own 策略在，但表级权限不在）。
--
-- 修复：显式 GRANT UPDATE 给 authenticated（幂等），并幂等重建更新策略。
--       安全由 profiles_update_own 的 RLS + trg_prevent_self_promote 触发器
--       （is_admin 仅管理员可改）共同保障。
-- ═══════════════════════════════════════════════

grant update on public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ═══ 验证 ═══
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated';
-- 应能看到 UPDATE

-- 回滚：
-- revoke update on public.profiles from authenticated;