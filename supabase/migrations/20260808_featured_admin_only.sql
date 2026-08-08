-- ============================================================================
-- 005_featured_admin_only.sql
-- Issue #50：编辑精选权限限制
--
-- 背景：任何登录用户都能通过 works_update_own RLS 策略直接 UPDATE 自己的
--       works 行，把 featured 列改成 true（绕过 set_featured RPC 的管理员校验）。
--
-- 修复（本文件）：
--   BEFORE UPDATE 触发器：当 featured 列发生变化时，校验当前用户是管理员
--   （is_admin()），非管理员直接 raise exception。即使 RLS 行级策略放行
--   （作者可改自己的行），触发器也会在写入前拦截 featured 变更。
--
--   为什么不用 REVOKE 列权限？
--   Supabase 平台会自动维护 anon/authenticated 对 public schema 的默认权限，
--   REVOKE 后会被平台加回（has_column_privilege 实测恒为 true），不可靠。
--   触发器是数据库对象，平台不会自动删除，原理上可靠。
--
-- 兼容性：
--   - set_featured RPC（管理员专用，内部已校验 is_admin()）仍可正常更新 featured
--     （管理员通过 RPC 写入时触发器校验也通过，不冲突）
--   - 普通用户正常编辑作品的其他字段（title/description 等）不受影响
--
-- 依赖：is_admin() 函数存在（001 迁移已定义）。
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行。幂等。
-- ============================================================================

-- 1. 触发器函数：featured 变更时校验管理员
create or replace function public.prevent_non_admin_featured()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.featured is distinct from old.featured and not public.is_admin() then
    raise exception 'permission denied: 精选仅管理员可设置';
  end if;
  return new;
end;
$$;

-- 2. 绑定到 works 表的 BEFORE UPDATE
drop trigger if exists trg_prevent_non_admin_featured on public.works;
create trigger trg_prevent_non_admin_featured
  before update on public.works
  for each row
  execute function public.prevent_non_admin_featured();

-- 3. 授权：authenticated 需要能调用该函数（security definer 函数默认仅 owner 可执行）
grant execute on function public.prevent_non_admin_featured() to authenticated, anon;

-- ============================================================================
-- 完成。验证：
--   普通用户 PATCH works.featured → 应报错 42501 / 权限错误
--   管理员 set_featured RPC → 应正常
-- ============================================================================
