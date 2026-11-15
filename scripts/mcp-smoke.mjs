#!/usr/bin/env node
// scripts/mcp-smoke.mjs
// 伊神导航 MCP 端点冒烟测试。两种模式：
//
//   1) 离线自检（不联网，验证工具注册与协议握手）：
//        node scripts/mcp-smoke.mjs --local
//      直接在进程内调用 createMcpHandler，不需要站点部署、不需要网络。
//
//   2) 线上实跑（验证真实部署）：
//        node scripts/mcp-smoke.mjs https://your-worker.workers.dev
//      也可以不传参，读环境变量 MCP_BASE_URL / YISHEN_BASE_URL。
//
// 退出码：全绿 0；有失败 1。CI 里可以直接跑。

import { createMcpHandler } from '@modelcontextprotocol/server';
import { serverFactory, SERVER_INFO } from '../workers/lib/mcp/server.js';
import { loadEnvLocal } from './lib/load-env.mjs';

const EXPECTED_TOOLS = [
  'list_partitions',
  'list_works',
  'get_recent_works',
  'get_top_works',
  'search_works',
];

const LEGACY_PROTOCOL = '2025-06-18';
const TIMEOUT_MS = 30000;

const args = process.argv.slice(2);
const localMode = args.includes('--local');
const baseArg = args.find((a) => !a.startsWith('-'));

const BASE_URL = (baseArg || process.env.MCP_BASE_URL || process.env.YISHEN_BASE_URL || '').replace(/\/+$/, '');
// 线上模式默认打 Worker 的 /mcp；-legacy-path 兼容旧的 /.netlify/functions/mcp 路径
const ENDPOINT = localMode
  ? 'https://local.test/mcp'
  : `${BASE_URL}/mcp`;

// ---------- 输出 ----------
const results = [];
const pass = (name, note = '') => {
  results.push({ name, ok: true, note });
  console.log(`  \x1b[32m✓\x1b[0m ${name}${note ? `\x1b[90m — ${note}\x1b[0m` : ''}`);
};
const fail = (name, note = '') => {
  results.push({ name, ok: false, note });
  console.log(`  \x1b[31m✗\x1b[0m ${name}${note ? `\x1b[90m — ${note}\x1b[0m` : ''}`);
};

/** 错误信息压成一行，避免把整页 HTML 刷满终端 */
const oneLine = (text, max = 140) => {
  const flat = String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

// ---------- JSON-RPC over HTTP（兼容 application/json 与 text/event-stream） ----------
let id = 0;
async function rpc(method, params) {
  id += 1;
  const body = { jsonrpc: '2.0', id, method };
  if (params !== undefined) body.params = params;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}：${oneLine(text, 100) || '（空响应）'}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const messages = contentType.includes('text/event-stream')
    ? text
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter(Boolean)
        .map((chunk) => JSON.parse(chunk))
    : text
      ? [JSON.parse(text)]
      : [];

  const msg = messages.find((m) => m.id === id) || messages[0];
  if (!msg) throw new Error('响应里没有 JSON-RPC 消息');
  if (msg.error) throw new Error(`JSON-RPC 错误 ${msg.error.code}：${msg.error.message}`);
  return msg.result;
}

// 工具返回的 content 是给模型看的文本，这里还原成对象
function unwrapToolText(result) {
  const text = (result?.content || []).map((c) => c.text || '').join('\n');
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ---------- 用例 ----------
async function checkSiteReachable() {
  const res = await fetch(`${BASE_URL}/health`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text().catch(() => '');
  if (res.status === 404) {
    if (/site-not-found|Build and deploy your own site/i.test(body)) {
      throw new Error('这不是 Worker 地址（返回了托管平台的 404 页），检查 BASE_URL');
    }
    throw new Error('Worker 未部署或路由不对（/health 返回 404）');
  }
  if (!res.ok) throw new Error(`/health 返回 HTTP ${res.status}`);
  pass('Worker 可达', `HTTP ${res.status}`);
}

async function checkInitialize() {
  const result = await rpc('initialize', {
    protocolVersion: LEGACY_PROTOCOL,
    capabilities: {},
    clientInfo: { name: 'yishen-mcp-smoke', version: '1.0.0' },
  });
  const info = result?.serverInfo || {};
  if (info.name !== SERVER_INFO.name) {
    throw new Error(`serverInfo.name 是 ${info.name}，期望 ${SERVER_INFO.name}`);
  }
  pass('initialize 握手', `${info.name}@${info.version}，协议 ${result.protocolVersion}`);
}

async function checkToolsList() {
  const { tools = [] } = (await rpc('tools/list')) || {};
  const names = tools.map((t) => t.name);
  const missing = EXPECTED_TOOLS.filter((n) => !names.includes(n));
  if (missing.length) throw new Error(`缺少工具：${missing.join(', ')}`);
  const noSchema = tools.filter((t) => !t.inputSchema).map((t) => t.name);
  if (noSchema.length) throw new Error(`工具缺 inputSchema：${noSchema.join(', ')}`);
  const noDesc = tools.filter((t) => !t.description).map((t) => t.name);
  if (noDesc.length) throw new Error(`工具缺 description：${noDesc.join(', ')}`);
  pass('tools/list', `${names.length} 个工具：${names.join(', ')}`);
}

async function callTool(name, callArgs, label = name) {
  const result = await rpc('tools/call', { name, arguments: callArgs });
  if (result?.isError) throw new Error(unwrapToolText(result).raw || '工具返回 isError');
  return unwrapToolText(result);
}

async function checkListPartitions() {
  const data = await callTool('list_partitions', {});
  if (!Array.isArray(data)) throw new Error('返回不是数组');
  pass('list_partitions', `${data.length} 个分区`);
}

async function checkListWorks() {
  const data = await callTool('list_works', { page: 1, page_size: 3 });
  if (!Array.isArray(data?.works)) throw new Error('缺少 works 数组');
  const first = data.works[0];
  if (first && (!first.id || !first.url)) throw new Error('作品缺 id/url 字段');
  pass('list_works', `第 1 页 ${data.works.length} 条，total=${data.total ?? 'null'}`);
}

async function checkRecentWorks() {
  const data = await callTool('get_recent_works', { days: 30, limit: 3 });
  if (!Array.isArray(data?.works)) throw new Error('缺少 works 数组');
  pass('get_recent_works', `近 30 天 ${data.works.length} 条`);
}

async function checkTopWorks() {
  const data = await callTool('get_top_works', { limit: 3 });
  if (!Array.isArray(data?.works)) throw new Error('缺少 works 数组');
  const likes = data.works.map((w) => w.likes);
  const sorted = likes.every((v, i) => i === 0 || likes[i - 1] >= v);
  if (!sorted) throw new Error(`点赞数不是降序：${likes.join(', ')}`);
  pass('get_top_works', `前 3 名点赞：${likes.join(', ')}`);
}

async function checkSearchWorks() {
  const data = await callTool('search_works', { keyword: 'AI', limit: 3 });
  if (!Array.isArray(data?.works)) throw new Error('缺少 works 数组');
  if (typeof data.matched !== 'number') throw new Error('缺少 matched 统计');
  pass('search_works', `关键词 AI：扫描 ${data.scanned} 条，命中 ${data.matched} 条`);
}

// ---------- 主流程 ----------
async function main() {
  await loadEnvLocal();

  if (!localMode && !BASE_URL) {
    console.error('用法：node scripts/mcp-smoke.mjs <Worker 地址>');
    console.error('      node scripts/mcp-smoke.mjs --local          # 离线自检');
    console.error('      MCP_BASE_URL=https://xxx.workers.dev node scripts/mcp-smoke.mjs');
    process.exit(2);
  }

  console.log(
    localMode
      ? '\x1b[1m伊神导航 MCP 冒烟测试（离线自检）\x1b[0m'
      : `\x1b[1m伊神导航 MCP 冒烟测试\x1b[0m\n端点：${ENDPOINT}`,
  );

  let handler = null;
  if (localMode) handler = createMcpHandler(serverFactory, { legacy: 'stateless' });

  // 离线模式：只拦截发往 MCP 端点的请求，交给进程内 handler；
  // 其余请求（data-proxy）照常走真实网络，保证工具调用链路与线上一致。
  const realFetch = globalThis.fetch;
  if (handler) {
    globalThis.fetch = (input, init) => {
      // callProxy 传的是 URL 对象，浏览器/其他地方可能是字符串或 Request
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input && input.url) || '';
      if (url.startsWith(ENDPOINT)) return handler.fetch(new Request(input, init));
      return realFetch(input, init);
    };
  }

  try {
    if (!localMode) {
      try {
        await checkSiteReachable();
      } catch (err) {
        fail('Worker 可达', oneLine(err.message));
        console.log(
          '\n\x1b[33mWorker 不可用，MCP 检查全部跳过。\x1b[0m\n' +
            '先确认 Worker 是否已部署（npm run worker:deploy），把可用地址传给本脚本再跑一次。',
        );
        return summarize();
      }
    }

    await guard(checkInitialize, 'initialize 握手');
    await guard(checkToolsList, 'tools/list');

    // 离线模式下工具调用走进程内 data-proxy（需要 Supabase 环境变量），失败也要给可读错误
    if (localMode) {
      const data = await callTool('list_partitions', {}).catch((err) => err);
      if (data instanceof Error) {
        pass('工具错误可读性', `未联网，按预期报错：${oneLine(data.message, 100)}`);
      } else {
        pass('列表/详情工具', '数据链路可达');
      }
    } else {
      await guard(checkListPartitions, 'list_partitions');
      await guard(checkListWorks, 'list_works');
      await guard(checkRecentWorks, 'get_recent_works');
      await guard(checkTopWorks, 'get_top_works');
      await guard(checkSearchWorks, 'search_works');
    }
  } finally {
    globalThis.fetch = realFetch;
    if (handler) await handler.close();
  }

  summarize();
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length
      ? `\n\x1b[31m${failed.length} 项失败\x1b[0m，${results.length - failed.length} 项通过`
      : `\n\x1b[32m全部 ${results.length} 项通过\x1b[0m`,
  );
  process.exit(failed.length ? 1 : 0);
}

async function guard(fn, label) {
  try {
    await fn();
  } catch (err) {
    fail(label, oneLine(err.message, 220));
  }
}

main().catch((err) => {
  console.error('\x1b[31m冒烟测试异常中止：\x1b[0m', err.message);
  process.exit(1);
});
