// netlify/functions/screenshot.mjs
// 截图代理：接收前端发来的目标 URL，由服务端转发给 Microlink（api.microlink.io），
// 避免浏览器直连第三方服务（隐私面 + 便于服务端限流/加密钥）。
import { getStore } from '@netlify/blobs';

const MICROLINK_API = process.env.VITE_SCREENSHOT_API_URL || 'https://api.microlink.io/';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 同一 URL 24h 内命中缓存

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405);

  const u = new URL(req.url);
  const target = u.searchParams.get('url');
  if (!target || !/^https?:\/\/.+/.test(target)) {
    return json({ error: '缺少有效的 url 参数' }, 400);
  }

  // 防滥用：仅允许 http(s)，且拦截指向内网/元数据服务的常见地址
  try {
    const parsed = new URL(target);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' || host === 'metadata.google.internal' || host === '169.254.169.254') {
      return json({ error: '不允许访问内网地址' }, 403);
    }
  } catch (_) {
    return json({ error: 'URL 格式无效' }, 400);
  }

  // 尝试缓存
  let store = null;
  try {
    store = getStore('screenshots');
  } catch (_) { /* Blobs 不可用则跳过缓存 */ }

  const cacheKey = `shot:${target}`;
  if (store) {
    try {
      const cached = await store.get(cacheKey, { type: 'json' });
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return json({ cached: true, ...cached.data });
      }
    } catch (_) { /* 忽略缓存读失败 */ }
  }

  const params = new URLSearchParams({
    url: target,
    screenshot: 'true',
    fullPage: 'false',
    waitUntil: 'load',
    delay: '2000',
    force: 'true',
    viewport: '1280x720',
    width: '1280',
    height: '720',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const res = await fetch(`${MICROLINK_API}?${params.toString()}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return json({ error: `Microlink 请求失败: HTTP ${res.status}` }, 502);
    const data = await res.json();
    if (data.status !== 'success' || !data.data?.screenshot?.url) {
      return json({ error: 'Microlink 返回异常' }, 502);
    }
    if (store) {
      try {
        await store.set(cacheKey, JSON.stringify({ fetchedAt: Date.now(), data }));
      } catch (_) { /* 缓存写失败忽略 */ }
    }
    return json({ cached: false, data: data.data });
  } catch (err) {
    clearTimeout(timeoutId);
    return json({ error: `截图失败: ${err.message}` }, 500);
  }
};
