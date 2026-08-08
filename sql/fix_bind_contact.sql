-- 修复 bind_contact：INSERT 5 列缺第 5 个值（updated_at）
-- 原版报错：INSERT has more target columns than expressions
-- 幂等：CREATE OR REPLACE，可重复执行
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
    nullif(p_phone, ''),
    now() -- 修复点：补上第 5 个值
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
