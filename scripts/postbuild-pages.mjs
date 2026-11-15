// scripts/postbuild-pages.mjs
// GitHub Pages 专用的构建后处理：
//
// 1. dist/index.html → dist/404.html
//    Pages 是纯静态托管，没有「未匹配路由回落到 index.html」这种重写能力。
//    它会把未知路径的 404.html 返回给浏览器（状态码 404），SPA 仍然会启动，
//    React Router 接管后正常渲染——这是深链接刷新不白屏的标准做法。
// 2. 写 .nojekyll
//    避免 Pages 用 Jekyll 处理产物（跳过下划线开头的文件/目录）。
import { copyFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

try {
  await copyFile(join(dist, 'index.html'), join(dist, '404.html'));
  console.log('SPA fallback: dist/index.html → dist/404.html');

  await writeFile(join(dist, '.nojekyll'), '');
  console.log('wrote dist/.nojekyll');
} catch (err) {
  console.error('postbuild-pages failed:', err.message);
  process.exit(1);
}
