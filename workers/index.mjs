// workers/index.mjs
// Cloudflare Worker 入口：把原先的 Netlify Functions 合并成一个带路由的 worker。
//
//   GET  /data-proxy?op=...    公开读缓存中转
//   GET  /screenshot?url=...   截图代理（SSRF 防护 + 24h 缓存）
//   POST /password-reset       找回密码（邮件验证码）
//   POST /export-idea          想法导出为 GitHub Issue（需登录态 JWT）
//   POST /yili-chat            依力 AI 对话（服务端持有 LLM 密钥）
//   GET/POST/DELETE /el-memory 依力记忆存取（写操作需 Bearer EL_MEMORY_TOKEN）
//   POST /mcp                  MCP 端点（Streamable HTTP，只读公开数据）
//
// 为什么合一个 worker：Cloudflare 的免费额度按 worker 计，单 worker 多路由更省，
// 而且 CORS、环境注入、错误处理只写一遍。
//
// 兼容旧路径：同时接受 /.netlify/functions/<name>，方便旧配置直接切过来。

import { setEnv } from './lib/blobs.mjs';
import { handler as mcpHandler } from './lib/mcp/http.js';

import dataProxy from './functions/data-proxy.mjs';
import screenshot from './functions/screenshot.mjs';
import passwordReset from './functions/password-reset.mjs';
import exportIdea from './functions/export-idea.mjs';
import yiliChat from './functions/yili-chat.mjs';
import elMemory from './functions/el-memory.mjs';

const ROUTES = {
  'data-proxy': dataProxy,
  screenshot,
  'password-reset': passwordReset,
  'export-idea': exportIdea,
  'yili-chat': yiliChat,
  'el-memory': elMemory,
};

// ---------- CORS ----------
// 静态站点在 <用户>.github.io，函数在 *.workers.dev，属于跨域调用。
// ALLOWED_ORIGINS（逗号分隔）用于收紧；不配则放行所有来源（公开只读数据 + JWT 自校验）。
const ALLOWED_ORIGINS = (env) =>
  String(env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowList = ALLOWED_ORIGINS(env);
  const allowed = allowList.length === 0 || allowList.includes(origin) ? origin || '*' : '';

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowed) headers['Access-Control-Allow-Origin'] = allowed;
  return headers;
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(request, env))) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    // blobs 兼容层需要拿到 KV 绑定
    setEnv(env);

    const url = new URL(request.url);
    // 同时支持 /mcp 与 /.netlify/functions/mcp
    const name = url.pathname.replace(/^\/+/, '').replace(/^\.netlify\/functions\//, '');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (name === 'health') {
      return withCors(new Response(JSON.stringify({ ok: true, routes: Object.keys(ROUTES) }), {
        headers: { 'Content-Type': 'application/json' },
      }), request, env);
    }

    try {
      if (name === 'mcp') {
        const response = await mcpHandler.fetch(request);
        return withCors(response, request, env);
      }

      const handler = ROUTES[name];
      if (!handler) {
        return withCors(new Response(JSON.stringify({ error: '未找到该接口' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }), request, env);
      }

      const response = await handler(request);
      return withCors(response, request, env);
    } catch (err) {
      console.error(`[${name}] 处理失败:`, err?.message || err);
      return withCors(new Response(JSON.stringify({ error: '服务暂时不可用，请稍后重试' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }), request, env);
    }
  },
};
