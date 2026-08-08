-- ═══════════════════════════════════════════════
-- 依神导航 · profiles 匿名读取收紧（issue #31 中危①）
-- 提供：轻歌（测试+后端）2026-08-08
-- 执行位置：Supabase Dashboard → SQL Editor
--
-- 问题：匿名用户可读 profiles 全字段，包括 is_admin 管理员标记、
--       role 角色（社工/冒充管理员的前置信息）。
-- 修复：anon 仅保留公开展示字段（创作者主页/评论区/首页需要），
--       隐藏 is_admin、role。
-- ═══════════════════════════════════════════════

-- 1. 撤销 anon 对 profiles 的全表 SELECT
REVOKE SELECT ON public.profiles FROM anon;

-- 2. 按列授权：只给公开展示字段
GRANT SELECT (
  id,
  username,
  avatar_url,
  bio,
  cover_url,
  expertise,
  tools,
  style_tags,
  current_project,
  creation_progress,
  collab_status,
  commission_status,
  services,
  socials,
  website_link,
  bg_color,
  accent_color,
  created_at,
  updated_at
) ON public.profiles TO anon;

-- ═══════════════════════════════════════════════
-- 验证：anon 对 profiles 只剩 SELECT，且列权限限于展示字段
-- ═══════════════════════════════════════════════
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_name = 'profiles';

-- 实测验证（SQL Editor 里看不出，执行后在浏览器控制台用 anon key 查）：
--   GET /rest/v1/profiles?select=is_admin&limit=1  → 应报 42501/权限错误
--   GET /rest/v1/profiles?select=username&limit=1  → 正常返回

-- 回滚（恢复全读）：
-- GRANT SELECT ON public.profiles TO anon;
