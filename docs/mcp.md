# MCP 服务（让 AI 客户端直接查站点作品）

> 站点提供一个 MCP（Model Context Protocol）端点，任何支持 MCP 的 AI 客户端
> （Claude Desktop / Cursor / Claude Code / OpenCode…）填上地址就能直接查询本站作品，
> 不用爬页面、不用解析 HTML。

部署结构见 [deploy-github-pages.md](deploy-github-pages.md)：静态站点在 GitHub Pages，
MCP 端点跑在 Cloudflare Worker 上。

## 1. 端点

```
https://yishen-api.<子域>.workers.dev/mcp
```

- 传输方式：**Streamable HTTP**（POST JSON-RPC，响应可能是 `application/json` 或 `text/event-stream`）
- 协议：`@modelcontextprotocol/server` v2（`^2.3.1`）实现 **2026-07-28 规范**；
  旧版客户端（协议 ≤ `2025-11-25`）由 handler 的 `legacy: 'stateless'` 兼容，**无会话、无 initialize 后续要求**。
- 鉴权：**无**。只读公开数据，权限等同匿名访客。
- 部署：与其它服务端函数同一个 Worker（`workers/index.mjs` 的 `/mcp` 路由）。

### 部署后先自检

```bash
# 离线自检：进程内跑 MCP 层（工具注册 + 协议握手），不依赖部署
npm run mcp:smoke -- --local

# 线上实跑：Worker 健康检查 → initialize → tools/list → 5 个工具逐个调用
node scripts/mcp-smoke.mjs https://yishen-api.<子域>.workers.dev
```

脚本退出码：全绿 `0`，有失败 `1`。第一项检查的是 Worker 的 `/health`——
如果 Worker 没部署或地址写错，后面全部跳过并直接提示。

## 2. 工具清单

| 工具 | 作用 | 参数 | 典型触发场景 |
| --- | --- | --- | --- |
| `list_partitions` | 列出全部分区 | 无 | 用户问「有哪些分类」；不确定该翻哪类时先调它 |
| `list_works` | 分页浏览作品 | `page`(1+) `page_size`(1-50) `work_type` `sort`(`new`/`hot`/`mixed`) | 「看看某类作品」「翻下一页」 |
| `get_recent_works` | 最近 N 天的新作品 | `days`(1-90，默认 14) `limit`(1-30，默认 8) | 「最近有什么新东西」 |
| `get_top_works` | 点赞榜 | `limit`(1-30，默认 8) | 「最火的」「最受欢迎的」 |
| `search_works` | 关键词搜索 | `keyword`（必填，支持中文） `limit`(1-30，默认 10) | 找特定主题，如「AI」「桌宠」 |

所有工具返回的都是**精简后的作品对象**（原始记录 30+ 字段会灌爆上下文）：

```jsonc
{
  "id": "uuid",
  "title": "标题",
  "author": "作者用户名",
  "type": "work_type",
  "summary": "简介前 200 字",
  "tags": ["标签"],
  "likes": 12,
  "views": 340,
  "url": "https://<用户名>.github.io/yishen-navigation/website/<id>",  // 前端详情页
  "cover": "封面地址",
  "created_at": "ISO 时间",
  "styles": ["风格"], "tools": ["工具"],       // 有值才出现
  "deploy_url": "..."                        // 有值才出现
}
```

调用失败不会抛异常，而是返回 `isError: true` + 中文错误说明，让模型自己决定下一步。

## 3. 客户端接入

> 各家配置格式一直在变，下面是最常见的写法；对不上时以客户端官方文档为准。

### Claude Code（命令行）

```bash
claude mcp add --transport http yishen-nav https://yishen-api.<子域>.workers.dev/mcp
```

### Cursor

项目根目录 `.cursor/mcp.json` 或全局 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "yishen-nav": {
      "url": "https://yishen-api.<子域>.workers.dev/mcp"
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`（菜单 Settings → Developer → Edit Config）：

```json
{
  "mcpServers": {
    "yishen-nav": {
      "type": "http",
      "url": "https://yishen-api.<子域>.workers.dev/mcp"
    }
  }
}
```

若你的版本还不认远程 HTTP，用官方桥接包转一次：

```json
{
  "mcpServers": {
    "yishen-nav": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://yishen-api.<子域>.workers.dev/mcp"]
    }
  }
}
```

### OpenCode

`opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "yishen-nav": {
      "type": "remote",
      "url": "https://yishen-api.<子域>.workers.dev/mcp",
      "enabled": true
    }
  }
}
```

### 其它客户端

任何支持「Streamable HTTP / 远程 MCP URL」的客户端，填端点地址即可；
只支持 stdio 的客户端用 `mcp-remote` 包一层。

## 4. 架构与代码位置

```
workers/index.mjs                 Worker 入口：路由 + CORS + 环境注入
        │
workers/lib/mcp/http.js           MCP HTTP 入口：createMcpHandler(serverFactory, { legacy: 'stateless' })
        │
workers/lib/mcp/server.js         工具定义：标题、描述、inputSchema、zod 校验
        │
workers/lib/mcp/yishen.js         数据层：字段精简 + 详情页链接拼接
        │
workers/functions/data-proxy.mjs  导出 runOp(op, params)：进程内直接执行查询（不走网络）
        │
Supabase                          works_with_likes / partitions 等公开视图（anon key + RLS）
```

- **为什么进程内调用**：MCP 与 data-proxy 在同一个 Worker 里，`runOp()` 直接复用同一份查询逻辑，
  省掉一次公网往返，也不再依赖「站点域名可访问」这个前提。
- **为什么每请求一个新实例**：2026-07-28 规范是无状态的，`serverFactory` 每次调用 `createServer()`。

### 加一个工具

只改 `server.js`：

```js
server.registerTool(
  'get_work',
  {
    title: '作品详情',
    description: '……（写清楚什么时候该用，模型靠这段文字决定要不要调）',
    inputSchema: z.object({ id: z.string().describe('作品 id') }),
  },
  async ({ id }) => run(() => yishen.getWork({ id })),
);
```

数据获取写在 `yishen.js` 里（优先复用 `runOp` 已有的 op）；改完跑
`npm run mcp:smoke -- --local` 确认工具注册正常。

## 5. 权限与安全边界

- **只读**：没有任何写操作（不能发布、点赞、评论、收藏）。
- **匿名权限**：只走 anon key + RLS，看到的数据和未登录访客完全一致。
- **不碰私有数据**：不读收藏、评论、私有/未公开作品、用户联系方式。
- **无密钥泄漏**：MCP 本身不需要密钥；Worker 里的其它密钥不会进入 MCP 的响应。
- 想加写操作的话，必须先设计鉴权（API key / OAuth），不能直接开——否则任何人都能以站点名义发内容。

## 6. 已知限制

| 限制 | 说明 |
| --- | --- |
| 搜索是「全站拉取 + 本地过滤」 | 单页上限 50 条、最多扫 10 页（`SEARCH_MAX_PAGES`），即 **500 条**封顶；站点变大后需要真正的搜索接口 |
| `sort: 'mixed'` 不返回总数 | 综合推荐走候选池（`pageSize×4`），接口回的是池子大小，所以 `total` 报 `null` |
| `new_works` 只扫 30 天内的少量记录 | `limit` 上限 30；要更长窗口用 `list_works` 分页 |
| 返回字段是精简版 | 需要完整字段就在 `slimWork()` 里加，注意上下文预算 |
| 依赖 Supabase 直连 | Worker 与 Supabase 之间是服务器间调用，正常；但 Supabase 抖动时会整体变慢 |

## 7. 排障

| 现象 | 先查什么 |
| --- | --- |
| 任何路由都 404 | Worker 没部署 / 地址写错 → `npx wrangler deploy`，然后 `curl https://<worker>/health` |
| `/health` 正常但工具报错 | Worker 缺 `SUPABASE_URL` / `SUPABASE_ANON_KEY` → `npx wrangler secret list` 核对 |
| 浏览器端接口 404 | 静态站点构建时没设 `VITE_FUNCTIONS_BASE` → Pages 构建里配 Actions 变量并重新构建 |
| 浏览器端 CORS 报错 | Worker 的 `ALLOWED_ORIGINS` 没包含站点域名；或本地开发直接打 Worker 时来源是 `http://localhost:5173` |
| 客户端连不上 / 协议错误 | 先跑 `node scripts/mcp-smoke.mjs <worker 地址>`；只支持 stdio 的客户端要加 `mcp-remote` |
| `el-memory❌` 写入后丢失 | 没绑 KV 命名空间（内存缓存会随实例回收）→ 见 [部署文档](deploy-github-pages.md#可选kv-命名空间持久缓存) |

## 8. 改域名时要同步的地方

| 位置 | 变量 |
| --- | --- |
| `wrangler.toml` `[vars]` | `SITE_ORIGIN`（作品详情页链接、想法导出的站内链接） |
| GitHub Actions 变量 | `VITE_FUNCTIONS_BASE`（Worker 地址） |
| GitHub Actions 构建 | `VITE_BASE`（项目页为 `/yishen-navigation/`，自定义域名改回 `/`） |
| Worker 密钥 | `ALLOWED_ORIGINS`（CORS 白名单） |

`workers/lib/mcp/yishen.js` 里的 `DEFAULT_BASE_URL` 只是兜底，优先读 `YISHEN_BASE_URL` / `SITE_ORIGIN`。
