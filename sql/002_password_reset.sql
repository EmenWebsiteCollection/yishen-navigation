-- ============================================================================
-- 002_password_reset.sql
-- 找回密码功能：profiles 绑定邮箱/手机 + 验证码表 + 绑定函数
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 幂等：可重复执行，不会报错。
-- ============================================================================

-- ---------- 1. profiles 增加 email / phone（唯一、可空） ----------
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

-- 只索引非空的联系方式，保证唯一但不阻止多个 NULL
drop index if exists public.profiles_email_key;
create unique index if not exists profiles_email_key
  on public.profiles (email) where email is not null and email <> '';

drop index if exists public.profiles_phone_key;
create unique index if not exists profiles_phone_key
  on public.profiles (phone) where phone is not null and phone <> '';

-- ---------- 2. 验证码表 ----------
create table if not exists public.password_reset_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact     text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  attempts    int not null default 0
);

create index if not exists password_reset_codes_lookup
  on public.password_reset_codes (contact_type, contact, expires_at);

-- RLS：普通角色（anon/authenticated）默认拒绝直接访问，
-- 由服务端 Edge Function 使用 service_role 绕过 RLS 进行读写。
alter table public.password_reset_codes enable row level security;
-- 故意不创建 anon/authenticated 的访问策略 => 默认拒绝

-- ---------- 3. 绑定联系方式（当前登录用户） ----------
-- SECURITY DEFINER：以定义者权限运行，确保 profiles 行缺失时也能插入；
-- 仅允许绑定「当前用户自己」的邮箱/手机。
create or replace function public.bind_contact(
  p_email text default null,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_profile  public.profiles;
begin
  if (p_email is null or p_email = '') and (p_phone is null or p_phone = '') then
    raise exception '至少需要提供邮箱或手机号之一';
  end if;

  -- 基本格式校验
  if p_email is not null and p_email <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception '邮箱格式不正确';
  end if;
  if p_phone is not null and p_phone <> '' and p_phone !~ '^\+?[0-9]{6,15}$' then
    raise exception '手机号格式不正确';
  end if;

  -- 取用户名（auth.users.email 的本地部分）作为 profiles.username 兜底
  select split_part(u.email, '@', 1)
    into v_username
    from auth.users u
   where u.id = auth.uid();

  insert into public.profiles (id, username, email, phone, updated_at)
  values (
    auth.uid(),
    coalesce(v_username, 'user'),
    nullif(p_email, ''),
    nullif(p_phone, '')
  )
  on conflict (id) do update
    set email = coalesce(nullif(p_email, ''), profiles.email),
        phone = coalesce(nullif(p_phone, ''), profiles.phone),
        updated_at = now();

  select * into v_profile from public.profiles where id = auth.uid();
  return v_profile;
end;
$$;

grant execute on function public.bind_contact(text, text) to authenticated;
