-- ═══════════════════════════════════════════════
-- 依神导航 · works_with_likes 视图重建（安全版）
-- 2026-08-17
--
-- ⚠️ 修正说明：
-- 原方案带 `security_invoker = true`，会与 20260817_restrict_anon_read.sql
-- 的 RLS 收紧冲突——anon 无 website_likes 权限，like_count 会失败/为 0，
-- 等于又开了一条匿名读 website_likes 的通道。
--
-- 正确做法：去掉 security_invoker（默认 definer 模式），视图以服务端权限
-- 执行——点赞数正常聚合，但不暴露 website_likes 明细（无 user_id 等敏感列）。
-- 匿名只能看到「作品有 N 个赞」，看不到谁点的赞。
-- ═══════════════════════════════════════════════

drop view if exists public.works_with_likes;

create view public.works_with_likes as
select
  w.id,
  w.url,
  w.title,
  w.description,
  w.image_url,
  w.cover_url,
  w.media_url,
  w.work_type,
  w.featured,
  w.status,
  w.visibility,
  w.group_id,
  w.changelog,
  w.tags,
  w.styles,
  w.tools,
  w.creative_type,
  w.completion,
  w.seeking_collab,
  w.derivative_allowed,
  w.commercial_use,
  w.ai_degree,
  w.audience,
  w.content_warning,
  w.created_at,
  w.updated_at,
  w.user_id,
  w.view_count,
  w.source_idea_id,
  w.video_url,
  w.deploy_url,
  w.deploy_updated_at,
  (select count(*)::int from public.website_likes l where l.website_id = w.id) as like_count,
  p.username,
  p.avatar_url
from public.works w
left join public.profiles p on p.id = w.user_id;

grant select on public.works_with_likes to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 验证：
--   anon:  GET /rest/v1/works_with_likes?select=id,like_count&limit=1
--          → 200 + like_count 正常数字（不报错）✅
--   anon:  GET /rest/v1/website_likes  → 0 行（RLS 仍拦，明细不泄露）✅
--   login: 点赞 → like_count +1 ✅
-- ═══════════════════════════════════════════════
