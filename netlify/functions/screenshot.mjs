// netlify/functions/screenshot.mjs
// 截图代理：接收前端发来的目标 URL，由服务端转发给 Microlink（api.microlink.io），
// 避免浏览器直连第三方服务（隐私面 + 便于服务端限流/加密钥）。
import { getStore } from '@netlify/blobs';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';

// 说明：服务端环境变量不用 VITE_ 前缀（VITE_ 会被打进前端包，见 #117）
const MICROLINK_API = process.env.SCREENSHOT_API_URL || process.env.VITE_SCREENSHOT_API_URL || 'https://api.microlink.io/';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 同一 URL 24h 内命中缓存

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}

// ── SSRF 防护：DNS 解析后检查是否为私有/保留/链路本地地址（#117） ──
// 覆盖：10.x / 172.16-31.x / 192.168.x / 127.x / 0.0.0.0 / 169.254.x（含云元数据）
//       / ::1 / fe80:: / fc00::（ULA）/ ::ffff:内网映射
function isPrivateIP(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;          // 192.168.0.0/16
    if (a === 127) return true;                       // loopback
    if (a === 0) return true;                         // 0.0.0.0/8
    if (a === 169 && b === 254) return true;          // 169.254.0.0/16（含 AWS/Azure 元数据）
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;                                  // loopback
    if (lower.startsWith('fe80')) return true;                         // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
    if (lower.startsWith('::ffff:')) return isPrivateIP(lower.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // 无法解析为 IP（含 hostname 本身）→ 保守拒绝
}

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
    const { address } = await dns.lookup(host, { all: true, verbatim: true });
    const ips = address.map((a) => a.address);
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
