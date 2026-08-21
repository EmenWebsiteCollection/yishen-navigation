// scripts/remove-bg.mjs
// 批量去除看板郎图片背景（纯白 / 棋盘格）和水印，输出透明 PNG。
// 用泛洪填充（flood fill）：仅将与边缘相连的背景像素置透明，
// 从而保留人物内部浅色像素（眼睛、高光）。
// 用法: node scripts/remove-bg.mjs

import { join } from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;
const TARGET_FILES = [
  'i.jpg', 'ii.jpg', 'iii.jpg', 'iv.jpg', 'v.jpg', 'vi.jpg',
  '待机.jpg', '挥手.jpg', '抱臂思考.jpg', '惊讶后退.jpg', '1.jpg',
];

// 判定是否为背景色（纯白 / 棋盘格 / 浅灰）
function isBackground(r, g, b) {
  const avg = (r + g + b) / 3;
  // 纯白 / 接近白
  if (r > 240 && g > 240 && b > 240) return true;
  // 棋盘格：浅灰 (~205) 或 中灰 (~210)
  if (avg > 195 && avg < 235 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12) return true;
  // 浅灰（地面阴影）
  if (r > 175 && g > 175 && b > 175 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18) return true;
  return false;
}

async function processImage(filename) {
  const inputPath = join(PUBLIC_DIR, filename);
  const outputPath = join(PUBLIC_DIR, filename.replace(/\.jpg$/i, '.png'));

  console.log(`处理: ${filename}`);

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const pixels = Buffer.alloc(width * height * 4);

  // 先拷贝 RGB 并初始化 alpha=255
  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * channels;
    const dstIdx = i * 4;
    pixels[dstIdx] = data[srcIdx];
    pixels[dstIdx + 1] = data[srcIdx + 1];
    pixels[dstIdx + 2] = data[srcIdx + 2];
    pixels[dstIdx + 3] = 255;
  }

  const idxOf = (x, y) => (y * width + x) * 4;
  const isBg = (x, y) => {
    const d = idxOf(x, y);
    return isBackground(pixels[d], pixels[d + 1], pixels[d + 2]);
  };

  // 泛洪填充：从边缘背景像素出发，标记相连背景
  const visited = new Uint8Array(width * height);
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pos = y * width + x;
    if (visited[pos]) return;
    visited[pos] = 1;
    if (isBg(x, y)) {
      queue.push(pos);
      pixels[idxOf(x, y) + 3] = 0; // 边缘背景直接透明
    }
  };

  // 四条边入队
  for (let x = 0; x < width; x++) { tryPush(x, 0); tryPush(x, height - 1); }
  for (let y = 0; y < height; y++) { tryPush(0, y); tryPush(width - 1, y); }

  // BFS 扩散
  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    const x = pos % width;
    const y = (pos / width) | 0;
    // 四邻域
    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  // 去水印区域（右下角浅色像素）
  const watermarkW = Math.floor(width * 0.25);
  const watermarkH = Math.floor(height * 0.15);
  const startX = width - watermarkW;
  const startY = height - watermarkH;

  for (let y = startY; y < height; y++) {
    for (let x = startX; x < width; x++) {
      const idx = idxOf(x, y);
      if (pixels[idx + 3] > 0) {
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        if (r > 190 && g > 190 && b > 190) {
          pixels[idx + 3] = 0;
        }
      }
    }
  }

  await sharp(pixels, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(outputPath);

  console.log(`  ✓ → ${filename.replace(/\.jpg$/i, '.png')}`);
}

async function main() {
  for (const f of TARGET_FILES) {
    try {
      await processImage(f);
    } catch (e) {
      console.error(`  ✗ ${f}: ${e.message}`);
    }
  }
  console.log('完成！');
}

main();
