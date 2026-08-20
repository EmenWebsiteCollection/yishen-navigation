-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #136：comments.adopted 防自封触发器
-- 2026-08-17
--
-- 问题：comments_update_own_or_admin 策略允许评论作者 PATCH 自己评论的全部列，
--       包括 adopted（采纳标记）。adopted 本应仅由作品作者通过
--       markCommentAdopted（append_adopted_comment RPC）标记，
--       直连 REST 自封 adopted=true 可抬高 get_commenter_reputation 中的
--       adopted_count（操纵评论信誉体系），issue #136。
--
-- 修复：BEFORE UPDATE 触发器（security definer）：
--   - adopted 变化时：仅作品作者（works.user_id = auth.uid()）或管理员可改
--   - 其他列（content 等）不受影响（评论编辑是产品功能）
--   - 非作者改 adopted → raise 42501
--
-- 说明：列级 REVOKE UPDATE 在 Supabase 平台会被自动还原（实测无效），
--       触发器是数据库对象，平台不会动——与 #50 featured 同款方案。
-- 幂等：drop trigger if exists + create trigger + create or replace function。
-- ═══════════════════════════════════════════════

create or replace function public.prevent_comment_adopted_self_mark()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_owner uuid;
begin
  -- adopted 值未变化 → 放行
  if new.adopted is not distinct from old.adopted then
    return new;
  end if;

  -- adopted 变化：仅作品作者或管理员可改
  select w.user_id into v_work_owner
    from public.works w
   where w.id = new.website_id;

  if v_work_owner is null then
    -- 作品不存在（异常数据）→ 拒绝
    raise exception 'permission denied'
      using errcode = '42501';
  end if;

  if auth.uid() = v_work_owner or public.is_admin() then
    return new;
  end if;

  raise exception 'permission denied: 仅作品作者可标记采纳'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_prevent_comment_adopted_self_mark on public.comments;
create trigger trg_prevent_comment_adopted_self_mark
  before update on public.comments
  for each row execute function public.prevent_comment_adopted_self_mark();

grant execute on function public.prevent_comment_adopted_self_mark() to authenticated, anon;

-- ═══════════════════════════════════════════════
-- 验证：
--   评论作者 PATCH 自己评论 {"adopted":true} → 400 42501（自封被拒）✅
--   作品作者 PATCH 该评论 {"adopted":true} → 204（正常采纳）✅
--   评论作者 PATCH 自己评论 {"content":"新内容"} → 204（编辑正常）✅
-- ═══════════════════════════════════════════════
