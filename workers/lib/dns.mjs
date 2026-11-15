// workers/lib/dns.mjs
// Workers 没有 node:dns，用 DNS over HTTPS 替代（Cloudflare/Google 的 JSON 接口）。
// 只用于 screenshot 代理的 SSRF 校验：把域名解析成 A/AAAA 记录再判断是否内网。

const DOH_ENDPOINTS = [
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve',
];

const TYPE_A = 1;
const TYPE_AAAA = 28;
const DNS_TIMEOUT_MS = 5000;

async function queryOnce(endpoint, name, type) {
  const url = `${endpoint}?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  const body = await res.json();
  const answers = Array.isArray(body.Answer) ? body.Answer : [];
  return answers.filter((a) => a.type === type).map((a) => a.data);
}

/**
 * 解析域名的全部 A/AAAA 记录。
 * @param {string} host
 * @returns {Promise<string[]>} IP 列表（解析失败时抛错）
 */
export async function lookupAll(host) {
  const results = await Promise.allSettled([
    queryOnce(DOH_ENDPOINTS[0], host, TYPE_A),
    queryOnce(DOH_ENDPOINTS[0], host, TYPE_AAAA),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled');
  if (ok.length === 0) {
    // 主探针整体失败，换备用 DoH 再试一次
    const retry = await Promise.allSettled([
      queryOnce(DOH_ENDPOINTS[1], host, TYPE_A),
      queryOnce(DOH_ENDPOINTS[1], host, TYPE_AAAA),
    ]);
    const retryOk = retry.filter((r) => r.status === 'fulfilled');
    if (retryOk.length === 0) throw new Error('DNS 解析失败');
    return retryOk.flatMap((r) => r.value);
  }
  return ok.flatMap((r) => r.value);
}
