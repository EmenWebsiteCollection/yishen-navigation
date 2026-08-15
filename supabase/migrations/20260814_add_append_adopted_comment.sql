-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #122：markCommentAdopted 并发竞态 → RPC 原子追加
-- 2026-08-14
--
-- 问题：前端先 SELECT adopted_comment_ids 再 UPDATE 写回（读-改-写），
--       并发采纳多条评论时会互相覆盖，丢失采纳记录。
-- 修复：新增 SECURITY DEFINER RPC 在数据库内原子执行
--       array_append，由 RPC 一次性完成追加。
-- ═══════════════════════════════════════════════

create or replace function public.append_adopted_comment(p_revision_id uuid, p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.work_revisions
     set adopted_comment_ids = array_append(coalesce(adopted_comment_ids, '{}'::uuid[]), p_comment_id)
   where id = p_revision_id;
end
$$;

grant execute on function public.append_adopted_comment(uuid, uuid) to authenticated, service_role;
