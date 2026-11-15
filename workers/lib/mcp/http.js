// workers/lib/mcp/http.js
// MCP 的 HTTP 入口（Streamable HTTP）。
//
// createMcpHandler 返回的 { fetch } 就是 web-standard 的请求/响应签名，
// Cloudflare Worker 直接调用即可，不需要适配层。
//
// 任何 MCP 客户端（Claude Desktop / Cursor / Claude Code / OpenCode…）填上
//   https://<worker 域名>/mcp
// 就能连上，让 AI 直接查站点作品，不用爬页面解析 HTML。

import { createMcpHandler } from '@modelcontextprotocol/server';
import { serverFactory } from './server.js';

export const handler = createMcpHandler(serverFactory, {
  // 2026-07-28 规范是无状态的原生协议；旧版客户端（≤2025-11-25）走无会话兜底
  legacy: 'stateless',
  onerror: (err) => console.error('[yishen-mcp]', err),
});
