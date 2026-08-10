-- Issue: works 表增加 download_url（软件下载链接，跳转到外部下载页/安装包）
-- 执行方式：在 Supabase SQL Editor 中运行本文件（需管理员权限）

alter table public.works
  add column if not exists download_url text;

-- 说明：
-- 1. download_url 为可空文本列，存储软件/游戏安装包或下载页链接，详情页渲染「下载」跳转入口
-- 2. works_with_likes 视图暂不包含 download_url（列表页不需要），无需重建；
--    若未来列表页要展示下载角标，需重建视图并补充该列
