-- ============================================================================
-- 007_prevent_self_promote.sql
-- 测试组发现：profiles 自提权漏洞（P0）
--
-- 背景：普通用户 REST 直连 PATCH 自己 profiles.is_admin=true 可提权为管理员
--      （实测：test_alice_0811 提权后成功删除 test_alice_0810 的作品）。
--      根因：profiles 只 REVOKE 了 SELECT 权限，UPDATE 列权限默认全开；
--      profiles_update_own 策略放行用户改自己的行 → is_admin 可被自改。
--      前端 updateProfile 白名单只拦正常流程，绕过 UI 直连 API 即提权。
--
-- 修复（本文件）：BEFORE UPDATE 触发器——is_admin 列变化时校验当前用户是
--   管理员（is_admin()），非管理员直接 raise exception。
--   与 005_featured_admin_only.sql 同款方案（列级 REVOKE 会被 Supabase
--   平台默认权限自动加回，实测不可靠；触发器是数据库对象，平台不删）。
--
-- 兼容性：
--   - 管理员改自己的 is_admin（撤权）：触发时 is_admin() 仍为 true，放行
--   - 管理员改他人 is_admin：is_admin() = true，放行
--   - 普通用户正常改自己其他字段（bio/头像等）：is_admin 未变化，不受影响
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行。幂等。
-- ============================================================================

-- 1. 触发器函数：is_admin 变更时校验管理员
create or replace function public.prevent_self_promote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception 'permission denied: 管理员权限仅管理员可修改';
  end if;
  return new;
end;
$$;

-- 2. 绑定到 profiles 表的 BEFORE UPDATE
drop trigger if exists trg_prevent_self_promote on public.profiles;
create trigger trg_prevent_self_promote
  before update on public.profiles
  for each row
  execute function public.prevent_self_promote();

-- 3. 授权（security definer 函数默认仅 owner 可执行）
grant execute on function public.prevent_self_promote() to authenticated, anon;

-- ============================================================================
-- 完成。验证：
--   普通用户 PATCH 自己 profiles.is_admin=true → 应报错 400 P0001
--   普通用户 PATCH 自己 bio → 应正常 204
--   ⚠️ 历史被提权账号排查：管理员在控制台查
--      select id, username, is_admin from profiles where is_admin = true;
--      核对每个管理员账号是否人为设置，非法的改回 false
-- ============================================================================
