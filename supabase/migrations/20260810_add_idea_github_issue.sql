-- ============================================================================
-- 20260810_add_idea_github_issue.sql
-- 想法集中营「一键导出 GitHub Issue」：ideas 表记录已导出的 Issue 编号
--
-- 背景：想法集中营的社区建议需要进入开发队列，管理员一键导出为 GitHub
--       Issue。github_issue_number 非空 = 已导出（防重复导出，详情页显示链接）。
--
-- 执行方式：Supabase SQL Editor 执行（幂等，可重复执行）
-- ============================================================================

alter table public.ideas add column if not exists github_issue_number integer;

create index if not exists ideas_github_issue_idx
  on public.ideas (github_issue_number)
  where github_issue_number is not null;
