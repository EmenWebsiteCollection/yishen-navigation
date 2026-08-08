-- ═══════════════════════════════════════════════
-- 依神导航 · 点击量统计（view_count）
-- 提供：轻歌（测试+后端）2026-08-08
-- 执行位置：Supabase Dashboard → SQL Editor
--
-- 功能：每个作品记录浏览量，详情页展示「👁 N 次浏览」
-- ═══════════════════════════════════════════════

-- 1. works 表加 view_count（幂等）
alter table public.works
  add column if not exists view_count integer not null default 0;

-- 2. 重建 works_with_likes 视图（补 view_count 列，列表/详情可读）
--    ⚠️ create or replace 不能加列，必须 drop + create（秒级窗口，可接受）
drop view if exists public.works_with_likes;

create view public.works_with_likes
with (security_invoker = true) as
select
  w.id,
  w.url,
  w.title,
  w.description,
  w.image_url,
  w.cover_url,
  w.work_type,
  w.featured,
  w.status,
  w.visibility,
  w.group_id,
  w.changelog,
  w.created_at,
  w.updated_at,
  w.user_id,
  w.view_count,
  (select count(*)::int from public.website_likes l where l.website_id = w.id) as like_count,
  p.username,
  p.avatar_url
from public.works w
left join public.profiles p on p.id = w.user_id;

-- 3. 浏览量计数函数（SECURITY DEFINER：任何角色可调，只做 +1，
--    绕过「非作者不能 UPDATE」的 RLS——浏览量是公开写入场景）
create or replace function public.rpc_increment_view(p_work_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.works set view_count = view_count + 1 where id = p_work_id;
$$;

-- 4. 授权（匿名/登录用户都可调用）
grant execute on function public.rpc_increment_view(uuid) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 验证：
--   select id, title, view_count from public.works order by view_count desc limit 5;
--   详情页应显示「👁 N 次浏览」，打开一次 +1（同会话不重复计）
-- 回滚：
--   drop function if exists public.rpc_increment_view(uuid);
--   alter table public.works drop column if exists view_count;
--   （视图重建回滚需用 001 迁移里的原定义）
-- ═══════════════════════════════════════════════
