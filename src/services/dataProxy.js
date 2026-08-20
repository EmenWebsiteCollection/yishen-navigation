// src/services/dataProxy.js
// 公开读接口缓存中转（issue #127）：
// 浏览器 → Netlify Function（data-proxy）→ Supabase 服务器间直连，
// 结果缓存 5 分钟，绕开国内直连 Supabase 的 DNS 污染慢链路。
//
// 仅代理「公开读」数据（列表/轮播/高分榜/分区），不含用户私有数据；
// 任何失败都会抛出，调用方（works.js / partitions.js）据此回退到直连 Supabase，
// 不影响现有功能。

const PROXY_PATH = '/.netlify/functions/data-proxy';

// 是否启用代理：生产环境默认开启，可用 VITE_USE_DATA_PROXY=0 关闭；
// 本地 vite dev 无函数运行时，自动跳过（避免多一次必然失败的请求）。
export const isDataProxyEnabled = () => {
  if (import.meta.env.DEV) return false;
  return String(import.meta.env.VITE_USE_DATA_PROXY ?? '1') !== '0';
};

/**
 * 发起公开读代理请求。
 * @param {string} op - works_list / new_works / top_works / partitions
 * @param {object} params - 查询参数
 * @returns {Promise<{ok:boolean, cached:boolean, data:Array, count?:number}>}
 */
export const dataProxyFetch = async (op, params = {}) => {
  const qs = new URLSearchParams({ op });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const res = await fetch(`${PROXY_PATH}?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`数据中转请求失败（HTTP ${res.status}）`);
  const body = await res.json().catch(() => null);
  if (!body || body.ok !== true) throw new Error(body?.error || '数据中转响应异常');
  return body;
};
