# SQL 迁移说明（依门第一阶段）

在 Supabase Dashboard → SQL Editor 中执行，顺序如下：

| 文件 | 说明 |
|------|------|
| `000_diagnose.sql` | 可选。迁移前/后运行，输出结构供核对 |
| `001_works_generalization.sql` | 必执行。works 泛化 + 创作者档案 + 收藏/分组 + 存储桶 |
| `002_discovery.sql` | 发现系统：follows / work_relations / works_discovery 视图 + 发现 rail/随机/精选 RPC |
| `002_partitions.sql` | 首页可动态添加的分区表（仅管理员维护） |
| `002_password_reset.sql` | 找回密码：profiles.email/phone + 验证码表 + bind_contact() |
| `003_feedback_annotations.sql` | 结构化评论（8 类型）+ 局部批注 + work_media 存储桶 |
| `004_comment_quality_revisions.sql` | 评论质量评价 + 评论者声誉 + 作品成长档案（版本快照） |
| `005_featured_admin_only.sql` | 编辑精选仅管理员可设（触发器方案） |
| `006_is_admin_function.sql` | `is_admin()` 判定函数（供 RPC/策略复用） |
| `007_prevent_self_promote.sql` | 防自提权：is_admin 变更触发器 |
| `007_yili_ai_v3.sql` | 依力 AI 3.0：pgvector + yili_corpus 语料库 + user_memories 记忆 |
| `008_feedback_status.sql` | 反馈状态字段（审核/处理状态） |
| `009_work_deploys.sql` | 拖拽文件一键部署：work_deploys 公开桶 + deploy_url |
| `010_idea_github_issue.sql` | 想法一键导出 GitHub Issue（管理员） |
| `011_cleanup_redundant_objects.sql` | 冗余对象清理（双触发器/重复策略，幂等） |
| `fix_bind_contact.sql` | 修复旧版 bind_contact（执行 002 报错时补跑） |
| `work_media_bucket.sql` | ⚠️ 早期脚本，已被 003 正式迁移取代，仅作参考不要单独执行 |

> 提示：同名编号（002×3、007×2）为历史遗留，各脚本相互独立、幂等可重复执行；
> 另有 `supabase/migrations/` 目录为同一批迁移的日期命名副本（供 Supabase CLI 用），内容一致。

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
