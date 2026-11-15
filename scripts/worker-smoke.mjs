#!/usr/bin/env node
// scripts/worker-smoke.mjs
// Cloudflare Worker 的本地冒烟测试：直接在 Node 里调用 worker 的 fetch handler，
// 不需要 wrangler、不需要部署，用来验证路由、CORS、数据链路与 MCP 端点。
//
//   node scripts/worker-smoke.mjs
//
// 会读取仓库根的 .env.local（如果有）补齐 SUPABASE_URL / SUPABASE_ANON_KEY，
// 这样 data-proxy 与 MCP 的查询能真的打到 Supabase。
//
// 退出码：全绿 0，有失败 1。

import { loadEnvLocal } from './lib/load-env.mjs';

const results = [];
const pass = (name, note = '') => {
  results.push({ name, ok: true });
  console.log(`  \x1b[32m✓\x1b[0m ${name}${note ? `\x1b[90m — ${note}\x1b[0m` : ''}`);
};
const fail = (name, note = '') => {
  results.push({ name, ok: false });
  console.log(`  \x1b[31m✗\x1b[0m ${name}${note ? `\x1b[90m — ${note}\x1b[0m` : ''}`);
};

const oneLine = (text, max = 160) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

async function main() {
  await loadEnvLocal();

  const { default: worker } = await import('../workers/index.mjs');

  const call = (path, init = {}) =>
    worker.fetch(new Request(new URL(path, 'http://worker.local'), init), process.env, {});

  const jsonBody = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { __raw: oneLine(text, 120) };
    }
  };

  console.log('\x1b[1mCloudflare Worker 本地冒烟测试\x1b[0m');

  // 1. 健康检查与路由
  try {
    const res = await call('/health');
    const body = await jsonBody(res);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (!Array.isArray(body.routes)) throw new Error('routes 字段缺失');
    pass('/health', `${body.routes.length} 条路由`);
  } catch (err) {
    fail('/health', oneLine(err.message));
  }

  // 2. 未知路由 → 404
  try {
    const res = await call('/nope');
    if (res.status !== 404) throw new Error(`期望 404，实际 ${res.status}`);
    pass('未知路由 404');
  } catch (err) {
    fail('未知路由 404', oneLine(err.message));
  }

  // 3. CORS 预检
  try {
    const res = await call('/data-proxy', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.github.io' },
    });
    if (res.status !== 204) throw new Error(`期望 204，实际 ${res.status}`);
    if (!res.headers.get('access-control-allow-origin')) throw new Error('缺少 CORS 头');
    pass('CORS 预检', `allow-origin=${res.headers.get('access-control-allow-origin')}`);
  } catch (err) {
    fail('CORS 预检', oneLine(err.message));
  }

  // 4. data-proxy（真实打 Supabase）
  try {
    const res = await call('/data-proxy?op=partitions');
    const body = await jsonBody(res);
    if (!body.ok) throw new Error(oneLine(body.error || 'ok=false'));
    pass('data-proxy partitions', `${(body.data || []).length} 个分区，cached=${body.cached}`);
  } catch (err) {
    fail('data-proxy partitions', oneLine(err.message));
  }

  // 5. MCP：tools/list
  try {
    const res = await call('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const text = await res.text();
    const messages = (res.headers.get('content-type') || '').includes('text/event-stream')
      ? text
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => JSON.parse(l.slice(5).trim()))
      : [JSON.parse(text)];
    const tools = messages[0]?.result?.tools || [];
    if (tools.length === 0) throw new Error('没有返回工具');
    pass('MCP tools/list', tools.map((t) => t.name).join(', '));
  } catch (err) {
    fail('MCP tools/list', oneLine(err.message));
  }

  // 6. MCP：真调一次工具（验证进程内数据链路）
  try {
    const res = await call('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'list_partitions', arguments: {} },
      }),
    });
    const text = await res.text();
    const messages = (res.headers.get('content-type') || '').includes('text/event-stream')
      ? text
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => JSON.parse(l.slice(5).trim()))
      : [JSON.parse(text)];
    const result = messages[0]?.result;
    if (result?.isError) throw new Error(oneLine(result.content?.[0]?.text));
    const payload = JSON.parse(result.content[0].text);
    pass('MCP list_partitions', `${payload.length} 个分区（进程内直连，无公网往返）`);
  } catch (err) {
    fail('MCP list_partitions', oneLine(err.message));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length
      ? `\n\x1b[31m${failed.length} 项失败\x1b[0m，${results.length - failed.length} 项通过`
      : `\n\x1b[32m全部 ${results.length} 项通过\x1b[0m`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('\x1b[31m冒烟测试异常中止：\x1b[0m', err.message);
  process.exit(1);
});
