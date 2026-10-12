// netlify/functions/mcp.mjs
// 伊神导航站的 MCP 端点（MCP 2026-07-28 规范）。
//
// 任何 MCP 客户端（Claude Desktop / Cursor / Hermes / Claude Code…）填上
//   https://<站点域名>/.netlify/functions/mcp
// 就能连上，让 AI 直接查站点作品，不用爬页面解析 HTML。
//
// 实现放在 netlify/lib/mcp/ 下（而非 functions/ 里，避免被 Netlify 当成独立函数）：
//   lib/mcp/yishen.js  数据层：只读调用本站 data-proxy 公开接口
//   lib/mcp/server.js  工具定义：分区/列表/最新/点赞榜/搜索
//   lib/mcp/http.js    组装 handler（同一份工具逻辑也供本地 stdio 入口使用）
//
// 只读公开数据，匿名权限，RLS 照常生效，不涉及任何用户私有数据，也没有写操作。

export { default } from '../lib/mcp/http.js';
