# SQL 迁移说明（依门第一阶段）

在 Supabase Dashboard → SQL Editor 中执行，顺序如下：

| 文件 | 说明 |
|------|------|
| `000_diagnose.sql` | 可选。迁移前/后运行，输出结构供核对 |
| `001_works_generalization.sql` | 必执行。works 泛化 + 创作者档案 + 收藏/分组 + 存储桶 |

## 执行 001 之后

1. 原 `websites` 表更名为 `works`；保留 `websites` 只读兼容视图。
2. `profiles` 新增创作者档案字段（头像/封面/介绍/标签/状态/外链/装扮色）。
3. 新建 `favorites`、`groups` 表及对应 RLS。
4. 新建 `works_with_likes` 视图（RLS 感知，私密作品对他人自动隐藏）。
5. 新增统计函数 `get_creator_stats`、`get_work_favorite_count`（只返回聚合数）。
6. 新建 `avatars`、`covers` 公开存储桶。

## 若执行报错

把报错信息原样发回，我会给出修复脚本。常见可接受的情况：

- `policy "xxx" already exists` 之类——本脚本已按策略名清理，一般不会出现；
- 若历史 `websites.url` 存在重复，唯一索引不受影响（约束已随表保留）；
- 若某条 `ALTER` 因列已存在而提示，可忽略（幂等设计）。
