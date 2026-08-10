// src/services/chunkRegistry.js
// 通过 Vite 构建产物 manifest.json 解析懒加载页面的真实 chunk URL，
// 供路由预加载与弱网下的缓存穿透重试使用。manifest 拿不到时优雅降级。
// 注：Vite 默认输出在 .vite/ 点目录，Netlify 不提供该目录下的文件，
// 因此构建脚本会复制到 dist/manifest.json（见 scripts/copy-chunk-manifest.mjs）。
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const MANIFEST_URL = `${BASE}/manifest.json`;

const assetUrl = (file) =>
  file && (file.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(file))
    ? file
    : `${BASE}/${file}`;

let registryPromise = null;

export function getChunkRegistry() {
  if (!registryPromise) {
    registryPromise = fetch(MANIFEST_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .catch((err) => {
        console.warn("chunk manifest 加载失败:", err.message);
        return {};
      });
  }
  return registryPromise;
}

// 根据页面源路径（如 "src/pages/WebsiteDetailPage.jsx"）解析真实 chunk URL
export async function chunkUrlFor(sourcePath) {
  const registry = await getChunkRegistry();
  const entry = registry[sourcePath];
  return entry ? assetUrl(entry.file) : null;
}

export function prefetchPageChunks() {
  return getChunkRegistry().then((registry) => {
    const seen = new Set();
    const urls = [];
    for (const [src, entry] of Object.entries(registry)) {
      if (!src.startsWith("src/pages/")) continue;
      const url = assetUrl(entry.file);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    for (const url of urls) {
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = url;
      document.head.appendChild(link);
    }
    return urls;
  });
}
