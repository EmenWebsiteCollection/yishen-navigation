// src/components/ChunkPrefetch.jsx
import { useEffect } from "react";
import { prefetchPageChunks } from "../services/chunkRegistry.js";

// 首屏加载完成后，把各懒加载页面的 chunk 提前以 modulepreload 拉进缓存，
// 弱网下导航时无需再走一次慢速网络请求，能显著降低路由加载失败的概率。
export function ChunkPrefetch() {
  useEffect(() => {
    prefetchPageChunks();
  }, []);
  return null;
}

export default ChunkPrefetch;
