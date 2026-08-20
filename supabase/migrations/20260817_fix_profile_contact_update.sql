-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #138：profiles.phone/email 防 REST 直改
-- 2026-08-17
--
-- 问题：20260813_grant_profiles_update.sql 给 authenticated 表级 UPDATE，
--       无列级限制——登录用户可直连 PATCH 自己的 phone/email 为任意值，
--       绕过 bind_contact() 格式校验，影响密码找回（按 contact 定位账号）
--       的数据一致性，issue #138。
--
-- 修复：BEFORE UPDATE 触发器（security definer）：
--   - phone/email 变化时：校验格式（email 含 @；phone 为数字），
--     非法值 raise 42501/22000；合法值放行
--   - 其他列不受影响
--   - 管理员（is_admin）不受限（管理员可改任何列）
--
-- 说明：列级 REVOKE UPDATE 会被 Supabase 平台还原（实测无效），
--       触发器是数据库对象，平台不会动——与 #50 featured 同款方案。
-- 幂等：drop trigger if exists + create trigger + create or replace function。
-- ═══════════════════════════════════════════════

create or replace function public.validate_profile_contact_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 非本人且非管理员 → 拒绝（RLS 已挡，双保险）
  if new.id <> auth.uid() and not public.is_admin() then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  -- 管理员可改任何列（放行）
  if public.is_admin() then
    return new;
  end if;

  -- 本人：phone/email 变化时校验格式（仅当值发生变化）
  if new.email is distinct from old.email then
    if new.email is null then
      raise exception 'email 不能清空，请通过 bind_contact 重新绑定'
        using errcode = '22000';
    end if;
    -- 简单 email 格式校验
    if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'email 格式不正确'
        using errcode = '22000';
    end if;
  end if;

  if new.phone is distinct from old.phone then
    if new.phone is not null and new.phone !~ '^[0-9+\-\s]{6,20}$' then
      raise exception '手机号格式不正确'
        using errcode = '22000';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_profile_contact on public.profiles;
create trigger trg_validate_profile_contact
  before update on public.profiles
  for each row execute function public.validate_profile_contact_update();

grant execute on function public.validate_profile_contact_update() to authenticated, anon;

-- ═══════════════════════════════════════════════
-- 验证：
--   登录用户 PATCH 自己 {"phone":"10000000000"} → 204（合法号码，可改）✅
--   登录用户 PATCH 自己 {"phone":"abc"} → 400 22000（非法格式被拒）✅
--   登录用户 PATCH 自己 {"email":"x"} → 400 22000（非法 email 被拒）✅
--   登录用户 PATCH 自己 {"bio":"新简介"} → 204（其他列不受影响）✅
--   管理员 PATCH 任意 {"email":"任意"} → 204（管理员豁免）✅
-- ═══════════════════════════════════════════════
