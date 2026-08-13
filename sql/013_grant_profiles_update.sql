-- ============================================================================
-- 013_grant_profiles_update.sql
-- 修复「编辑主页保存失败：permission denied for table profiles」
-- 根因：profiles 仅列级 SELECT 被显式授权，authenticated 表级 UPDATE 权限缺失，
--      PostgREST PATCH 需同时满足表级 GRANT 与 RLS 策略。
-- 修复：显式 GRANT UPDATE + 幂等重建 profiles_update_own 策略。
-- 执行：Supabase Dashboard → SQL Editor → 粘贴执行。幂等。
-- ============================================================================

grant update on public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- 验证：
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema='public' and table_name='profiles' and grantee='authenticated';
