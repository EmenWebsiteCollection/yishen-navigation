// scripts/copy-chunk-manifest.mjs
// Netlify 默认不发布/提供 .vite/ 点目录下的文件，
// 把 Vite 生成的 chunk manifest 复制到 dist/manifest.json，供前端运行时解析。
import { cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'dist', '.vite', 'manifest.json');
const to = join(root, 'dist', 'manifest.json');

try {
  await cp(from, to);
  console.log('chunk manifest copied to dist/manifest.json');
} catch (err) {
  console.error('copy chunk manifest failed:', err.message);
  process.exit(1);
}
