// src/services/functionsBase.js
// 服务端函数的地址解析（统一入口，避免散落各处的 /.netlify/functions/ 硬编码）。
//
// 背景：站点静态资源托管在 GitHub Pages，但 Pages 没有服务端运行时，
// 所以需要密钥的函数（data-proxy / screenshot / password-reset / yili-chat /
// el-memory / export-idea / mcp）跑在 Cloudflare Worker 上。
//
// 优先级：
//   1. VITE_FUNCTIONS_BASE —— 配置了就用它（形如 https://yishen-api.xxx.workers.dev）
//   2. 没配置时回退旧的相对路径 /.netlify/functions/xxx（兼容 Netlify 部署与 netlify dev）
//
// 注意：VITE_* 会被打包进前端 JS，只能放公开地址，不能放任何密钥（见 #147）。

export const FUNCTIONS_BASE = (import.meta.env.VITE_FUNCTIONS_BASE || '').replace(/\/+$/, '');

/**
 * 解析某个函数的完整地址。
 * @param {string} name 函数名，如 'data-proxy'
 * @returns {string}
 */
export const functionUrl = (name) =>
  FUNCTIONS_BASE ? `${FUNCTIONS_BASE}/${name}` : `/.netlify/functions/${name}`;
