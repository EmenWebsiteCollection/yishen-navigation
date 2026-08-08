# Task.md

# 第一阶段：四、创作者主页 + 个人中心（含 works 泛化、收藏、统计与时间线）

> 状态图例：⬜ 未开始 · 🔄 进行中 · ✅ 已完成

## PR1：数据层 + works 泛化 + 个人中心

- [ ] ✅ 数据层：websites→works 泛化、profiles 创作者档案字段、favorites/groups 表、works_with_likes 视图、统计函数、avatars/covers 存储桶（sql/001_works_generalization.sql）
- [ ] ✅ 服务层：works.js（CRUD/点赞/收藏/分组）、users.js（档案+统计）、comments.js（头像 join）、screenshot.js（通用上传）
- [ ] ✅ 页面：/profile 个人中心（我的作品 / 我的收藏 / 设置）
- [ ] ✅ 既有页面适配 works 命名与签名
- [ ] ✅ 文档：project.md / task.md / ui.md 更新

## PR2：创作者主页 + 统计 + 时间线 + 入口

- [x] ✅ 页面：/user/:id 创作者主页（封面/头像/介绍/画像/状态/作品集/时间线/统计）
- [x] ✅ 入口：首页卡片头像、轮播作者、评论区头像、详情页作者、导航「个人中心」
- [x] ✅ 详情页：收藏按钮 + 更新日志区块
- [x] ✅ 创建/编辑表单泛化：作品类型选择、封面、公开/私密、分组、更新日志
- [x] ✅ 多模态任务卡：封面/装扮视觉素材交接 CGPT 组员

> 📌 文档核对（2026-08-08）：以上 PR2 条目经代码核对确认均已实现并合入 main
> （CreatorProfilePage.jsx / HomePage 入口 / WebsiteDetailPage 收藏与更新日志 /
> Create·EditWebsitePage 表单泛化 / docs/多模态任务卡-封面素材.md），
> 由 docs/align-docs 分支更新本状态。

## 验收（手工）

- [ ] 创作者主页所有区块数据正确、装扮生效
- [ ] 统计口径正确（仅公开作品）；私密作品对他人/未登录不可见
- [ ] 收藏/取消、收藏数与个人中心列表同步
- [ ] 分组增删改与作品分配；删除分组后作品变未分组
- [ ] 更新日志保存后详情页展示；精选标记生效
- [ ] 非网站类作品可创建/展示（无 URL 也可）
- [ ] 首页仍是网站导航且不受影响；所有入口跳转正确
- [ ] 用他人账号复核 RLS


---

# Issue #12：想法集中营（feat/idea-camp）

> 目标：想法 → 回应 → 孵化 → 实现的完整闭环；避免「板子凉了」的三大陷阱（空板/无回应/不闭环）。

## 数据层（迁移 supabase/migrations/20260808_add_idea_camp.sql，已执行并验证）

- [x] works.source_idea_id（作品孵化来源）
- [x] ideas（分类/标签/状态/关联作品/置顶）+ ideas_with_stats 视图（security_invoker）
- [x] idea_votes（一人一票唯一约束）/ idea_favorites（收藏=关注，私密）/ idea_comments（回复树）/ idea_updates（进展时间线）
- [x] RLS：匿名禁写、作者/管理员兜底；授权 anon/authenticated
- [x] get_creator_stats 扩展（想法数/想法获赞/已实现数）；merge_ideas 管理员合并函数
- [x] 种子 supabase/seed/idea_seed.sql：13 条真实想法（3 条已实现示范 + 2 置顶 + 8 灵感）

## 服务层（src/services/ideas.js + idea-logic.js）

- [x] getIdeas（分类/状态/搜索/最新·最热/置顶优先）/ getIdeaById（含本人投票·关注状态）
- [x] createIdea（校验 + 服务端限流 1h≤3 / 24h≤10）
- [x] 投票/关注 toggle、评论树（回复/删除）、进展时间线
- [x] updateIdeaStatus（状态变更自动写时间线，关闭必填理由）/ addIdeaUpdate
- [x] findSimilarIdeas（复用 search.js normalizeQuery/escapeLike + 打分）
- [x] mergeIdeas（管理员合并，投票/评论转移 + 双端留痕）
- [x] linkIdeaToWork（孵化闭环：作品发布自动点亮「已实现」并回链）
- [x] 纯逻辑测试 src/services/ideas.test.js：20 组断言，node 直跑通过

## 页面与入口

- [x] /ideas 列表（搜索/分类/状态/排序/分页/空态）/ /ideas/new 发布（相似提示）/ /ideas/:id 详情（投票/关注/评论/时间线/状态管理/合并/去实现）
- [x] 顶部导航「想法集中营」；首页入口横幅；个人中心 Tab「我的想法」（发布+关注）
- [x] 作品侧：创建页接 source_idea_id；详情页回显「孵化自想法」
- [x] 创作者主页统计：想法数/获赞/已实现数（get_creator_stats）

## 文档

- [x] project.md（v0.4 更新日志）/ task.md / ui.md（三个新页面 + 入口联动）
- [x] docs/ideas-ops.md 运营手册（每周 30 分钟例行 / 想法星期三 / 闭环仪式 / 防刷治理 / 状态语义 / SQL 速查）

## 验收（手工，待用户执行）

- [ ] 游客可浏览/搜索想法；登录发布（限流触发）；一人一票不可重复
- [ ] 相似提示与「去实现」孵化闭环；作品发布后想法自动「已实现」并回链
- [ ] 状态变更/补进展写时间线；关闭必填理由；管理员合并生效
- [ ] 关注=收藏，个人中心可见；评论与回复；移动端断点
- [ ] 用他人账号复核 RLS（匿名不能写）
