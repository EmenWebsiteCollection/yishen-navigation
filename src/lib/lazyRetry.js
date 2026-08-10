// src/lib/lazyRetry.js
import { lazy } from "react";
import { chunkUrlFor } from "../services/chunkRegistry.js";

// 路由级懒加载的 chunk 在弱网（如 Netlify 海外 CDN）下可能偶发下载失败。
// 注意：浏览器会把“下载失败”的动态 import 缓存在模块表里，同 URL 重试不会
// 发起新请求，所以重试时给 chunk URL 追加时间戳参数做缓存穿透，强制重新拉取。
export function lazyWithRetry(
  loader,
  { exportName, sourcePath, retries = 3, baseDelay = 400 } = {},
) {
  const toComponent = (m) => ({
    default: m ? (exportName ? m[exportName] : m.default) : null,
  });
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const bustedImport = async () => {
    const url = await chunkUrlFor(sourcePath);
    if (!url) throw new Error(`未知 chunk URL: ${sourcePath}`);
    return import(
      /* @vite-ignore */ url + (url.includes("?") ? "&" : "?") + "r=" + Date.now()
    );
  };
  return lazy(() => {
    const attempt = (left, mode) => {
      const fetch = mode === "bust" ? bustedImport : loader;
      return fetch()
        .then(toComponent)
        .catch((err) => {
          if (left <= 0) {
            console.error("路由懒加载失败（已重试）:", err);
            throw err;
          }
          const wait = baseDelay * (retries - left + 1);
          return delay(wait).then(() => attempt(left - 1, "bust"));
        });
    };
    return attempt(retries, "plain");
  });
}

export default lazyWithRetry;
