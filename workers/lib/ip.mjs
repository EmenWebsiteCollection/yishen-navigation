// workers/lib/ip.mjs
// 轻量 IP 判定工具（替代 node:net 的 isIP，Workers 上不保证可用）。
// 返回 4 / 6 / 0，与 node:net 的 isIP 语义一致。

const V4_PART = /^(0|[1-9]\d{0,2})$/;

export function isIP(input) {
  const value = String(input || '').trim();
  if (!value) return 0;

  if (value.includes(':')) {
    return isIPv6(value) ? 6 : 0;
  }

  const parts = value.split('.');
  if (parts.length !== 4) return 0;
  for (const part of parts) {
    if (!V4_PART.test(part)) return 0;
    if (Number(part) > 255) return 0;
  }
  return 4;
}

function isIPv6(value) {
  // 允许 :: 缩写与 ::ffff:1.2.3.4 形式，够 SSRF 判定用即可
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return false;
  if ((value.match(/::/g) || []).length > 1) return false;

  const [head, tail] = value.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];

  // 末尾允许内嵌 IPv4
  const last = (tail || head || '').split(':').pop();
  const hasEmbeddedV4 = last.includes('.');

  if (hasEmbeddedV4 && isIP(last) !== 4) return false;

  const total = headGroups.length + tailGroups.length + (value.includes('::') ? 1 : 0);
  if (value.includes('::')) return total <= 8;
  return headGroups.length === 8;
}

/** 私有 / 保留 / 链路本地地址判定（SSRF 防护） */
export function isPrivateIP(ip) {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16（云元数据）
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('::ffff:')) return isPrivateIP(lower.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // 无法解析 → 保守拒绝
}
