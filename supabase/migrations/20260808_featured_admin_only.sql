-- ============================================================================
-- 20260808_featured_admin_only.sql
-- Issue #50：编辑精选功能权限限制——数据库层兜底
--
-- 背景：
--   works 表 RLS（works_update_own）允许作者更新自己作品的任意列（含 featured），
--   此前个人中心「设精选」按钮直改 works.featured 绕过 set_featured RPC 的管理员校验，
--   导致任何登录用户可精选自己的作品。
--   set_featured RPC 已含 is_admin 校验（20260808_add_discovery.sql），本脚本再从
--   触发器层面兜底：无论前端/API/其他代码怎么更新 featured，非管理员一律拒绝。
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行。
-- ============================================================================

-- 1. 触发器函数：featured 列发生变化时，非管理员直接拒绝
create or replace function public.prevent_non_admin_featured_change()
returns trigger
language plpgsql
as $$
begin
  if NEW.featured is distinct from OLD.featured and not public.is_admin() then
    raise exception 'permission denied: only admin can change featured (Issue #50)';
  end if;
  return NEW;
end;
$$;

-- 2. 挂到 works 表（列级：仅 featured 变更时触发；set_featured RPC 显式更新该列，正常放行）
drop trigger if exists trg_works_featured_admin_only on public.works;
create trigger trg_works_featured_admin_only
  before update of featured on public.works
  for each row
  execute function public.prevent_non_admin_featured_change();

-- ============================================================================
-- 验证：
--   select tgname from pg_trigger
--   where tgrelid = 'public.works'::regclass and tgname = 'trg_works_featured_admin_only';
-- 预期返回 1 行。
-- ============================================================================
