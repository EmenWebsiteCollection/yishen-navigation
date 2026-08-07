-- Issue #10: works 表增加 video_url（演示视频链接，跳转到视频网站观看）
-- 执行方式：在 Supabase SQL Editor 中运行本文件（需管理员权限）

alter table public.works
  add column if not exists video_url text;

-- 说明：
-- 1. video_url 为可空文本列，存储 B站/YouTube 等视频页链接，详情页渲染「观看演示视频」跳转入口
-- 2. works_with_likes 视图暂不包含 video_url（列表页不需要），无需重建；
--    若未来列表页要展示视频角标，需重建视图并补充该列
