-- ============================================================
-- 迁移脚本：修复 websites 和 website_likes 的 INSERT RLS 策略
-- 创建时间：2026-08-06
-- 创建人：数据库与后端组
-- 说明：当前 INSERT 策略只验证了用户已登录（authenticated），
--       但未验证 user_id 是否为操作者本人，导致任意登录用户可
--       冒充他人发布网站/点赞。本迁移修复此安全漏洞。
-- ============================================================

-- 1. 修复 websites 表的 INSERT 策略
--    确保只有 user_id = auth.uid() 的插入才被允许
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.websites;
DROP POLICY IF EXISTS "users_insert_own_websites" ON public.websites;

CREATE POLICY "users_insert_own_websites" ON public.websites
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 2. 修复 website_likes 表的 INSERT 策略
--    同上，防止冒充他人点赞
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.website_likes;
DROP POLICY IF EXISTS "users_insert_own_likes" ON public.website_likes;

CREATE POLICY "users_insert_own_likes" ON public.website_likes
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 3. 补充：外键索引（postgres-patterns 反模式检测）
--    点赞查询高频按 website_id 过滤，加索引避免全表扫描
CREATE INDEX IF NOT EXISTS idx_website_likes_website_id 
  ON public.website_likes (website_id);

-- 评论表同样按 website_id 查询
CREATE INDEX IF NOT EXISTS idx_comments_website_id 
  ON public.comments (website_id);

-- ============================================================
-- 验证方法（在 Supabase SQL Editor 中执行以下查询）：
--
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename IN ('websites', 'website_likes');
--
-- 预期结果：
--   users_insert_own_websites  | INSERT | NULL | (auth.uid() = user_id)
--   users_insert_own_likes     | INSERT | NULL | (auth.uid() = user_id)
-- ============================================================
