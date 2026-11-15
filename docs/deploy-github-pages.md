# 部署：GitHub Pages（静态）+ Cloudflare Workers（服务端函数）

> 站点已从 Netlify 迁到 **GitHub Pages 托管静态资源** + **Cloudflare Worker 托管需要密钥的函数**。
> Pages 是纯静态托管，没有服务端运行时；凡是需要隐藏密钥、做缓存、做代理的逻辑都放在 Worker 上。

```
浏览器 ──> https://<用户名>.github.io/yishen-navigation/   ← 静态资源（Pages）
   │
   └────> https://yishen-api.<子域>.workers.dev/<路由>      ← 服务端函数（Worker）
              ├─ /data-proxy      公开读缓存中转
              ├─ /screenshot      截图代理
              ├─ /password-reset  找回密码（邮件验证码）
              ├─ /export-idea     想法导出 GitHub Issue
              ├─ /yili-chat       依力 AI 对话
              ├─ /el-memory       依力长期记忆
              └─ /mcp             MCP 端点
```

## 1. 部署静态站点（GitHub Pages）

工作流已经写好：`.github/workflows/deploy-pages.yml`（推 `main` 自动跑，也可手动 `workflow_dispatch`）。

需要一次性配置：

1. **仓库 Settings → Pages → Build and deployment → Source 选 `GitHub Actions`**。
2. **Settings → Secrets and variables → Actions → New repository secret**，加两个构建期变量：

   | 名称 | 值 |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<项目>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | 你的 anon key（公开信息，见 #147） |

3. **同页 Variables 标签页**，加 Worker 地址（有了 Worker 之后再填）：

   | 名称 | 值 |
   | --- | --- |
   | `VITE_FUNCTIONS_BASE` | `https://yishen-api.<子域>.workers.dev` |

> 不填 `VITE_FUNCTIONS_BASE` 也能构建，但页面调用会退回 `/.netlify/functions/*`（Pages 上没有这个路径 → 404）。
> 有兜底的功能（数据列表、截图）会自动降级，找回密码 / 依力 AI / 想法导出会直接不可用。

### 子路径细节（已经处理好，改域名时才需要动）

- 项目页地址带仓库名前缀，构建时必须 `VITE_BASE=/yishen-navigation/`（`build:pages` 脚本已内置）。
- 路由 basename 取自 `import.meta.env.BASE_URL`（`src/main.jsx`），chunk manifest / logo / 表情包路径也都用 `BASE_URL` 拼，无需额外改动。
- **SPA 深链接**：Pages 没有「未匹配路径回退 index.html」的能力，靠 `dist/404.html`（= `index.html` 的副本）兜底，由 `scripts/postbuild-pages.mjs` 生成。
- `dist/.nojekyll` 同脚本生成，避免 Jekyll 处理产物。

## 2. 部署 Worker（Cloudflare）

```bash
npx wrangler login        # 首次登录（浏览器授权）
npx wrangler deploy       # 发布，输出 https://yishen-api.<子域>.workers.dev
```

配置在 `wrangler.toml`：

- `compatibility_flags = ["nodejs_compat"]` —— 找回密码的 HMAC、data-proxy 的 sha256 缓存键依赖 `node:crypto`。
- `[vars]` 里放**非敏感**配置：`SITE_ORIGIN`（站点地址）、`GITHUB_REPO`（想法导出目标仓库）。

### 需要的密钥（`wrangler secret put <名字>`）

| 密钥 | 用途 | 必需 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase 项目地址 | ✅ |
| `SUPABASE_ANON_KEY` | 公开读（data-proxy） | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 找回密码 / 想法导出 | ✅（这两个功能） |
| `LLM_API_KEY` | 依力 AI（DeepSeek） | ✅（AI 功能） |
| `GITHUB_TOKEN` | 想法导出成 Issue | ✅（导出功能） |
| `EMAIL_PROVIDER` / `EMAIL_FROM` / `EMAIL_API_KEY` / `EMAIL_API_URL` | 发验证码邮件 | ✅（找回密码） |
| `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` | 走阿里云 DirectMail 时 | 可选 |
| `EL_MEMORY_TOKEN` | `el-memory` 写操作鉴权 | 可选 |
| `ALLOWED_ORIGINS` | CORS 白名单（逗号分隔），不配则放行所有来源 | 建议配置 |
| `LLM_URL` / `LLM_MODEL` / `DASHSCOPE_API_KEY` | 模型与风格向量检索 | 可选 |

示例：

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put ALLOWED_ORIGINS      # 值如 https://<用户名>.github.io
```

### 可选：KV 命名空间（持久缓存）

```bash
npx wrangler kv namespace create CACHE     # 输出 id
```

把 id 填进 `wrangler.toml` 的 `[[kv_namespaces]]` 后重新 deploy。
不绑也能跑：缓存退化为「单实例内存」，只影响命中率；但 `el-memory`（依力长期记忆）需要持久化，建议绑定。

## 3. 验证

```bash
# Worker 本地自检：路由 / CORS / data-proxy / MCP，直接在 Node 里跑 worker 的 fetch handler
npm run worker:smoke

# Worker 本地调试（wrangler 自带 miniflare）
npm run worker:dev          # http://localhost:8787

# 线上 Worker 的 MCP 端点
node scripts/mcp-smoke.mjs https://yishen-api.<子域>.workers.dev
```

`worker:smoke` 会读 `.env.local` 补齐 Supabase 凭据，所以能在本机直接验证真实数据链路。

## 4. 迁移对照表

| 原 Netlify | 现在 |
| --- | --- |
| `netlify/functions/*.mjs`（7 个独立函数） | `workers/index.mjs` 路由到 `workers/functions/*.mjs`（单个 Worker） |
| `/.netlify/functions/<name>` | `/<name>`（Worker 也兼容旧的 `/.netlify/functions/<name>` 路径） |
| `@netlify/blobs` | `workers/lib/blobs.mjs`（Cloudflare KV，未绑定时退化为内存） |
| `node:dns` / `node:net`（SSRF 校验） | `workers/lib/dns.mjs`（DoH）+ `workers/lib/ip.mjs` |
| `netlify.toml`（重写/缓存/安全头） | SPA 回退 → `404.html`；安全头 Pages 不支持配置（只能靠 HTML `<meta>`） |
| 环境变量 | `wrangler secret put`（密钥）/ `[vars]`（明文配置） |

## 5. 已知差异与注意事项

- **安全响应头**：GitHub Pages 不能自定义 HTTP 头，原来 `netlify.toml` 里的 `X-Frame-Options` / `CSP` / `Referrer-Policy` 等**全部失效**。如需保留，只能：
  1. 在 `index.html` 里用 `<meta http-equiv="Content-Security-Policy">`（能力有限，不支持所有指令）；
  2. 或给站点套一层 Cloudflare（自定义域 + Transform Rules）来注入响应头。
  > 这一条属于安全面退化，建议后续单独评估（记 issue 跟踪）。
- **首次访问变慢**：没有 Netlify 的边缘缓存规则，静态资源仍由 Pages 的 Fastly CDN 提供；`data-proxy` 的 5 分钟缓存依然生效（Worker 侧）。
- **自定义域名**：如果以后绑自定义域名，记得同步改 `wrangler.toml` 的 `SITE_ORIGIN`、`VITE_BASE`（改回 `/`）和 Pages 的 CNAME。
- **`npm run dev` 仍然可用**：本地开发不依赖 Worker（`isDataProxyEnabled()` 在 dev 下返回 false，直接连 Supabase）。
