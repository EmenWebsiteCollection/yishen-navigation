-- ============================================================================
-- 依神导航 · 安全修复：rpc_increment_view 匿名可调
-- 2026-08-17
--
-- 问题：rpc_increment_view 是 SECURITY DEFINER 且未在函数内校验角色，
--       匿名调用者可无限制触发视图计数。
-- 修复：函数内显式校验 auth.role()，非 authenticated / service_role 一律
--       返回 42501；grant 保留 anon/authenticated 以覆盖平台自动恢复，
--       实际匿名调用由函数体拦截。
-- 幂等：create or replace + grant，可重复执行。
-- ============================================================================

create or replace function public.rpc_increment_view(p_work_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() not in ('authenticated', 'service_role') then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  update public.works
     set view_count = view_count + 1
   where id = p_work_id;
end
$$;

grant execute on function public.rpc_increment_view(uuid) to anon, authenticated;