// scripts/fix-eyes.mjs
// 在现有透明 PNG 上微调：用泛洪填充从边缘重新判定背景，
// 恢复被误删的人物内部浅色像素（眼白/高光）。
// 覆盖写回原文件。用法: node scripts/fix-eyes.mjs

import { join } from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;
const TARGET_FILES = [
  'i.png', 'ii.png', 'iii.png', 'iv.png', 'v.png', 'vi.png',
  '待机.png', '挥手.png', '抱臂思考.png', '惊讶后退.png', '1.png',
];

function isBackground(r, g, b) {
  const avg = (r + g + b) / 3;
  if (r > 240 && g > 240 && b > 240) return true;             // 纯白
  if (avg > 195 && avg < 235 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12) return true; // 棋盘浅灰
  if (r > 175 && g > 175 && b > 175 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18) return true; // 浅灰
  return false;
}

async function processImage(filename) {
  const path = join(PUBLIC_DIR, filename);
  console.log(`处理: ${filename}`);

  const image = sharp(path);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const pixels = Buffer.from(data); // 保留 RGB+现有 alpha

  const idxOf = (x, y) => (y * width + x) * channels;
  const isBg = (x, y) => {
    const d = idxOf(x, y);
    return isBackground(pixels[d], pixels[d + 1], pixels[d + 2]);
  };

  // 泛洪填充：从边缘背景像素出发
  const visited = new Uint8Array(width * height);
  const queue = [];
  const tryPush = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pos = y * width + x;
    if (visited[pos]) return;
    visited[pos] = 1;
    if (isBg(x, y)) queue.push(pos);
  };

  for (let x = 0; x < width; x++) { tryPush(x, 0); tryPush(x, height - 1); }
  for (let y = 0; y < height; y++) { tryPush(0, y); tryPush(width - 1, y); }

  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    const x = pos % width;
    const y = (pos / width) | 0;
    const d = idxOf(x, y);
    pixels[d + 3] = 0; // 背景像素透明
    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  // 非背景像素恢复为不透明（恢复眼白等内部浅色像素）
  for (let i = 0; i < width * height; i++) {
    if (!visited[i]) {
      pixels[i * channels + 3] = 255;
    }
  }

  // 去除右下角水印区域（重新置透明）
  const watermarkW = Math.floor(width * 0.25);
  const watermarkH = Math.floor(height * 0.15);
  const startX = width - watermarkW;
  const startY = height - watermarkH;
  for (let y = startY; y < height; y++) {
    for (let x = startX; x < width; x++) {
      const idx = idxOf(x, y);
      if (pixels[idx + 3] > 0) {
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        if (r > 190 && g > 190 && b > 190) pixels[idx + 3] = 0;
      }
    }
  }

  await sharp(pixels, { raw: { width, height, channels } }).png().toFile(path);
  console.log(`  ✓ ${filename}`);
}

async function main() {
  for (const f of TARGET_FILES) {
    try { await processImage(f); } catch (e) { console.error(`  ✗ ${f}: ${e.message}`); }
  }
  console.log('完成！');
}

main();
