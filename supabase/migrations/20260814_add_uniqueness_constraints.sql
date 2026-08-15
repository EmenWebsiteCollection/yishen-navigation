-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #123：并发竞态缺数据库约束兜底
-- 2026-08-14
--
-- 问题：应用层 check-then-act 竞态（URL 唯一性检查、修订版本号分配）
--       都依赖"先查再写"，并发时会产生重复数据。
-- 修复：补数据库唯一约束，让竞态在 DB 层被拒绝（23505），
--       应用层 catch 后返回友好提示。
-- ═══════════════════════════════════════════════

-- 1. works.url 唯一约束（部分唯一：仅网站类作品有 URL）
--    注意：已有历史重复数据的库需要先清理才能加约束；
--    若执行失败，先查重复：select url, count(*) from works
--    where url is not null group by url having count(*) > 1;
drop index if exists works_url_unique_idx;
create unique index works_url_unique_idx on public.works (url)
  where url is not null;

-- 2. work_revisions (work_id, revision_no) 唯一约束
--    版本号并发分配（max+1）会被 DB 唯一约束兜住
drop index if exists work_revisions_work_rev_unique_idx;
create unique index work_revisions_work_rev_unique_idx
  on public.work_revisions (work_id, revision_no);

-- ═══ 验证 ═══
-- select indexname from pg_indexes
-- where tablename in ('works','work_revisions')
-- and indexname in ('works_url_unique_idx','work_revisions_work_rev_unique_idx');

-- 回滚：
--   drop index works_url_unique_idx;
--   drop index work_revisions_work_rev_unique_idx;
