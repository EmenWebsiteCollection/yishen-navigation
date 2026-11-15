// workers/functions/screenshot.mjs
// 截图代理：接收前端发来的目标 URL，由服务端转发给 Microlink（api.microlink.io），
// 避免浏览器直连第三方服务（隐私面 + 便于服务端限流/加密钥）。
import { getStore } from '../lib/blobs.mjs';
import { lookupAll } from '../lib/dns.mjs';
import { isIP, isPrivateIP } from '../lib/ip.mjs';

// 说明：服务端环境变量不用 VITE_ 前缀（VITE_ 会被打进前端包，见 #117）
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 同一 URL 24h 内命中缓存

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}

// ── SSRF 防护：DNS 解析后检查是否为私有/保留/链路本地地址（#117） ──
// 判定逻辑在 lib/ip.mjs（Workers 没有 node:net），DNS 解析走 lib/dns.mjs 的 DoH。

// 校验目标 URL 并解析 host 的每个 IP，命中私有/保留地址即拒绝
async function checkTargetUrl(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return { ok: false, error: 'URL 格式无效' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: '仅支持 http/https 协议' };
  }
  const host = parsed.hostname.toLowerCase();
  // 字面 IP 直接判；域名则 DNS 解析全部 A/AAAA 记录逐一检查（防 DNS rebinding 的兜底在 fetch 前再校验一次）
  if (isIP(host)) {
    return isPrivateIP(host)
      ? { ok: false, error: '不允许访问内网地址' }
      : { ok: true, host, ips: [host] };
  }
  try {
    const ips = await lookupAll(host);
    if (ips.length === 0) return { ok: false, error: '域名无法解析' };
    if (ips.some((ip) => isPrivateIP(ip))) {
      return { ok: false, error: '不允许访问内网地址' };
    }
    return { ok: true, host, ips };
  } catch {
    return { ok: false, error: '域名无法解析' };
  }
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405);

  const u = new URL(req.url);
  const target = u.searchParams.get('url');
  if (!target || !/^https?:\/\//.test(target)) {
    return json({ error: '缺少有效的 url 参数' }, 400);
  }

  // SSRF 防护：DNS 解析 + 私有地址检查
  const check = await checkTargetUrl(target);
  if (!check.ok) return json({ error: check.error }, 403);

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

  // 说明：服务端环境变量不用 VITE_ 前缀（VITE_ 会被打进前端包，见 #117）
  const MICROLINK_API =
    process.env.SCREENSHOT_API_URL || process.env.VITE_SCREENSHOT_API_URL || 'https://api.microlink.io/';

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
    console.error('screenshot 代理失败:', err.message);
    return json({ error: '截图失败，请稍后重试' }, 500);
  }
};
