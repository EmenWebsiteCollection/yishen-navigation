# 依力 AI 完整部署与使用说明（v2 · 含站内搜索工具）

- **版本**: v2（一期前端对话面板 + 二期工具调用 agent）
- **关联**: Issue #56（原 yishen 项目）→ 现为 Rai 个人部署项目
- **更新时间**: 2026-08-08
- **代码位置**: `netlify/functions/yili-chat.mjs` + `src/components/YiliChatPanel.jsx`

---

## 一、这套东西是什么

```
用户输入
   ↓
聊天面板（前端，静态）
   ↓ POST {messages, persona}
yili-chat 代理函数（Netlify Function / 本地 Node）
   ↓ 带工具定义
LLM（云 API 或本地 Ollama）
   ↓ 模型自主决定是否调用工具
search_works → Supabase 检索站内作品 → 结果回传模型
   ↓ 模型组织回复
{reply} 返回前端展示
```

| 层 | 组件 | 说明 |
|----|------|------|
| 前端 | YiliChatPanel.jsx | 聊天 UI，纯静态，任何托管都能跑 |
| 代理 | yili-chat.mjs | 藏 key、拼人设、跑工具循环（最多 2 轮） |
| 模型 | DeepSeek / Ollama 本地模型 | OpenAI 兼容协议 |
| 工具 | search_works | 站内作品检索（Supabase 只读，按点赞排序） |

---

## 二、两种运行模式

| | 云 API 模式 | 本地模式（Ollama） |
|---|---|---|
| 模型 | DeepSeek（deepseek-chat） | qwen2.5:7b 等本地模型 |
| 需要 | LLM_API_KEY（约几块钱起充） | 无 key，免费 |
| 网络 | 需要联网 | 可完全离线 |
| 质量 | 高 | 中（闲聊够用） |
| 适合 | 正式上线 | 本地开发/学习/隐私场景 |

---

## 三、部署 A：Netlify（云 API 模式，正式上线）

### 3.1 环境变量（Netlify → Site settings → Environment variables）

| 变量 | 必填 | 示例 | 说明 |
|------|------|------|------|
| `LLM_URL` | 否 | `https://api.deepseek.com/chat/completions` | 默认即 DeepSeek，可换通义/智谱 |
| `LLM_API_KEY` | ✅ | `sk-xxxx` | DeepSeek/通义/智谱 的 key |
| `LLM_MODEL` | 否 | `deepseek-chat` | 模型名 |
| `SUPABASE_URL` | ✅ | `https://xxx.supabase.co` | 站内检索用 |
| `SUPABASE_ANON_KEY` | ✅ | `eyJhbGci...` | Supabase 匿名 key（只读检索够用） |
| `YILI_PERSONA` | 否 | （人设文本） | 覆盖内置依力人设 |

> 前端构建变量（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）也需要，但那是站点本身已有的配置。

### 3.2 部署步骤

1. 代码推到你自己的仓库（含 `netlify/functions/yili-chat.mjs`）
2. Netlify → Add new site → Import from Git（或 `netlify deploy` 拖拽 `dist/` + functions）
3. 配置上表环境变量
4. 部署完成 → 打开站点 → 右下角点击看板郎 → 聊天

### 3.3 验证函数

```bash
curl -X POST https://<你的站点>.netlify.app/.netlify/functions/yili-chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"推荐几个好玩的网站"}]}'
# 期望: {"reply":"...（依力推荐 + 站内真实作品）..."}
```

---

## 四、部署 B：全本地（Ollama，免费离线）

### 4.1 装模型

```bash
# 1. 安装 Ollama（https://ollama.com）
ollama pull qwen2.5:7b        # 中文聊天甜点位；8GB 显存够跑
# 可选: ollama pull deepseek-r1:7b   # 带推理
```

### 4.2 起本地 API

```bash
ollama serve
# OpenAI 兼容端点: http://localhost:11434/v1/chat/completions
```

### 4.3 配置并本地跑函数

方式一：Netlify CLI（推荐，函数 + 站点一起跑）
```bash
npm i -g netlify-cli
netlify dev
# 在项目根目录建 .env 文件（本地调试用）：
```

`.env` 内容（本地模式）：
```
LLM_URL=http://localhost:11434/v1/chat/completions
LLM_MODEL=qwen2.5:7b
# LLM_API_KEY 可留空（本地模式自动放行）
SUPABASE_URL=https://<你的项目>.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
VITE_SUPABASE_URL=https://<你的项目>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

方式二：vite 前端 + 单独起函数（进阶）
```bash
netlify functions:serve        # 单独起函数在 http://localhost:8888/.netlify/functions
npm run dev                    # 前端在 5173（此时需把 CHAT_ENDPOINT 指向 8888 端口或配 proxy）
```

### 4.4 本地验证

```bash
curl -X POST http://localhost:8888/.netlify/functions/yili-chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"推荐几个好玩的网站"}]}'
```

---

## 五、代理函数行为说明

| 行为 | 细节 |
|------|------|
| 人设 | 请求带 `persona` 则优先；否则用 `YILI_PERSONA` 环境变量；再否则内置默认人设 |
| 工具循环 | 最多 2 轮（模型调用工具 → 执行 → 回传 → 模型总结） |
| 超时 | LLM 请求 20s 超时，超时返回降级文案 |
| key 检查 | 云模式无 key → 503；本地模式（URL 含 localhost/127.0.0.1/11434）放行 |
| 搜索失败 | Supabase 未配置 → 工具返回错误，模型会如实说"搜索暂时不可用" |
| 安全 | key 只在服务端；搜索只读不写库 |

---

## 六、前端使用说明

- 入口：右下角看板郎「依力」，单击弹出对话面板
- 交互：输入 + Enter/按钮发送；思考中显示"依力正在想…"并禁用发送
- 降级：函数 404/5xx/网络错误 → 自动本地占位回复（UI 不崩）
- 移动端：面板自动变底部弹层
- 收起看板郎会同步收起面板；拖拽位置持久化（sessionStorage）

> 前端**不需要改动**即可从 v1 升级到 v2——契约始终是 `POST {messages, persona} → {reply}`。

---

## 七、站内搜索工具（二期核心）

模型在对话中自主判断何时调用 `search_works`：

```
参数:
  keyword   必填，搜索关键词（如"科幻""学习"）
  work_type 可选: website/novel/illustration/game/music/video/photo/other
  limit     可选，1-8，默认 5

示例（用户说"有没有悬疑小说"）:
  模型调用 search_works({keyword:"悬疑", work_type:"novel"})
  → 返回 [{title, type, likes, url}...]
  → 模型回复:"帮你找到了 2 部悬疑小说:《xxx》(❤️123)、《yyy》(❤️45)…"
```

- 检索逻辑：标题 `ilike` 模糊匹配 + 类型过滤 + 按点赞数降序
- 结果由模型自然语言化（会带上作品名和热度，比规则版更自然）

---

## 八、常见问题 FAQ

**Q: 函数返回 503「缺少 LLM_API_KEY」？**
A: 云模式没配 key，或 URL 不是本地模式。检查环境变量；用本地模式就确保 `LLM_URL` 含 localhost/11434。

**Q: Ollama 下模型不调用工具？**
A: 确认模型支持 function calling（qwen2.5 系列支持）。Ollama 版本太老需升级（≥0.3 支持 tools）。

**Q: 搜索没结果？**
A: ① 检查 `SUPABASE_URL/SUPABASE_ANON_KEY` 配了没；② 站内该关键词确实没作品；③ works 表结构变了的话调整 select 字段。

**Q: 回复慢？**
A: 云模式正常 2-5s；本地 7B 模型 20-40 token/s，一段话 10s 左右属正常。可换小模型（qwen2.5:3b）提速。

**Q: 想换通义/智谱？**
A: 换 `LLM_URL` + `LLM_MODEL` + key 即可，协议兼容。

---

## 九、v3 规划（未实现）

- **创建作品**：需要用户鉴权（把前端 Supabase session 传给函数）+ 写库权限 + 表单校验 → 单独设计
- **流式输出**：SSE/NDJSON 逐字显示（前端 YiliChatPanel 有升级点）
- **会话持久化**：历史存 Supabase，刷新不丢
- **混合路由**：本地模型兜底 + 云 API 处理复杂请求
