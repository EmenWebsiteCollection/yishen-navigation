-- ═══════════════════════════════════════════════
-- 依神导航 · 安全修复 #141：Storage 桶对象名防匿名枚举（修正版）
-- 2026-08-17
--
-- 问题：avatars/covers/screenshots 桶可用公开 key 匿名 list 对象名
--       （avatars/covers 直接以 user_id 命名 → 用户 ID 与文件映射泄露），
--       渗透测试 finding-2，issue #141。
--
-- 修复（修正版）：storage.objects 的 SELECT 策略只保留「本人目录可见」。
--   ⚠️ 关键认知：Supabase 公开桶的「公开读」（GET object/public/...）
--      不走 storage.objects 的 SELECT 策略（走 bucket public 标志），
--      所以收紧 SELECT **不影响头像/封面正常展示**；
--      list 枚举走 SELECT，收紧后匿名/他人无法 list 全桶。
--
-- 幂等：drop policy if exists + create policy。
-- ═══════════════════════════════════════════════

-- ---------- avatars 桶 ----------
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_list_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (
      auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ---------- covers 桶 ----------
drop policy if exists "covers_public_read" on storage.objects;
drop policy if exists "covers_list_own" on storage.objects;
create policy "covers_select_own" on storage.objects
  for select using (
    bucket_id = 'covers'
    and (
      auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ---------- screenshots 桶（收紧 list，保留公开读——作品截图要展示） ----------
drop policy if exists "screenshots_list_own" on storage.objects;
-- 保留现有 storage_images_public_read（公开读 screenshots 是设计）
drop policy if exists "screenshots_select_own" on storage.objects;
create policy "screenshots_select_own" on storage.objects
  for select using (
    bucket_id = 'screenshots'
    and (
      auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ---------- work_media 桶（同 screenshots） ----------
drop policy if exists "work_media_list_own" on storage.objects;
drop policy if exists "work_media_select_own" on storage.objects;
create policy "work_media_select_own" on storage.objects
  for select using (
    bucket_id = 'work_media'
    and (
      auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ═══════════════════════════════════════════════
-- 验证：
--   匿名:  POST /storage/v1/object/list/avatars → 空/被拒（枚举堵住）✅
--   匿名:  GET 公开头像 URL（object/public/avatars/...）→ 200（展示正常）✅
--   登录:  list 自己的目录 → 200 自己文件 ✅
-- 回滚：drop policy 对应策略即可。
-- ═══════════════════════════════════════════════
