-- ============================================================================
-- 20260809_add_feedback_status.sql
-- Issue #11：每作品反馈闭环（升级现有评论区）
--   comments 新增 feedback_status：作者可标记 处理中/已处理/已忽略
-- 幂等：可重复执行。
-- ============================================================================

alter table public.comments add column if not exists feedback_status text not null default 'open';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comments_feedback_status_check' and conrelid = 'public.comments'::regclass) then
    alter table public.comments add constraint comments_feedback_status_check
      check (feedback_status in ('open', 'resolving', 'resolved', 'ignored'));
  end if;
end $$;

-- ============================================================================
-- 完成。验证：
--   select column_name from information_schema.columns
--   where table_name='comments' and column_name='feedback_status';
-- ============================================================================
