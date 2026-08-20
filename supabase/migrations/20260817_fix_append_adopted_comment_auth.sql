-- ============================================================================
-- 依神导航 · 安全修复：append_adopted_comment 越权写
-- 2026-08-17
--
-- 问题：append_adopted_comment 是 SECURITY DEFINER，缺少角色与归属校验时，
--       可被调用方直接修改任意 work_revisions.adopted_comment_ids。
-- 修复：函数内显式校验 auth.role()，并校验 revision 对应的作品属于当前用户
--       或管理员；revision 不存在时静默返回，避免暴露 id 是否存在。
-- 幂等：create or replace + grant，可重复执行。
-- ============================================================================

create or replace function public.append_adopted_comment(p_revision_id uuid, p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_id uuid;
begin
  if auth.role() not in ('authenticated', 'service_role') then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  select work_id into v_work_id
    from public.work_revisions
   where id = p_revision_id;

  if v_work_id is null then
    return;
  end if;

  if not exists (
    select 1
      from public.works w
     where w.id = v_work_id
       and (w.user_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  update public.work_revisions
     set adopted_comment_ids = array_append(coalesce(adopted_comment_ids, '{}'::uuid[]), p_comment_id)
   where id = p_revision_id;
end
$$;

grant execute on function public.append_adopted_comment(uuid, uuid) to authenticated, service_role;