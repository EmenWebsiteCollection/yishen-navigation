// 线上入口——Netlify Function（Functions API v2，web-standard Request/Response）。
//
// createMcpHandler 返回的 { fetch } 正好就是 Functions v2 期望的签名，
// 不需要任何适配层。部署到伊神站仓库后，任何 AI 客户端填上
//   https://<站点域名>/.netlify/functions/mcp
// 就能连上。

import { createMcpHandler } from '@modelcontextprotocol/server';
import { serverFactory } from './server.js';

const handler = createMcpHandler(serverFactory, {
  // 默认值：2025 时代的客户端仍能被服务（无会话），新客户端走 2026-07-28 原生协议
  legacy: 'stateless',
  onerror: (err) => console.error('[yishen-mcp]', err),
});

export default async (request) => handler.fetch(request);
