-- ============================================================================
-- 000_diagnose.sql（可选）—— 在迁移前后运行，检查当前数据库结构
-- 用途：把输出结果发回，我据此确认迁移是否成功 / 排查问题。
-- ============================================================================

-- 1) 表清单
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) works 表列
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'works'
order by ordinal_position;

-- 3) profiles 表列
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;

-- 4) RLS 策略
select tablename, policyname, cmd, permissive
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5) 视图
select table_name from information_schema.views where table_schema = 'public' order by table_name;

-- 6) 存储桶
select id, name, public from storage.buckets order by id;

-- 7) 统计函数自检（替换为任意存在的用户 id）
-- select public.get_creator_stats('<uuid>') as stats;
