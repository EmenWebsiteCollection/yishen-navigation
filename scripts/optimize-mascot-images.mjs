// scripts/optimize-mascot-images.mjs
// 看板郎图片优化：压缩 + 转 WebP + 生成雪碧图。
// - yili.jpg (1880×1279, 360KB) → yili.webp (256×256, ~15KB) + yili-small.jpg (64×64 favicon)
// - Live2D idle 帧 i~vi.png (单帧 972KB~1.5MB) → mascot-idle-{0..5}.webp (240px 高) + 水平雪碧图
// - 交互帧 挥手/抱臂思考/惊讶后退.png → mascot-hover/think/click.webp (240×240)
// 用法: node scripts/optimize-mascot-images.mjs

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;

const LIVE2D_SIZE = 240;       // 显示 120px × 2（高清屏）
const LOGO_SIZE = 256;         // 显示 34~88px，2x=176，取 256 余量
const FAVICON_SIZE = 64;

const IDLE_FILES = ['i.png', 'ii.png', 'iii.png', 'iv.png', 'v.png', 'vi.png'];
const INTERACTIVE_FILES = {
  '挥手.png': 'mascot-hover.webp',
  '抱臂思考.png': 'mascot-think.webp',
  '惊讶后退.png': 'mascot-click.webp',
};

function log(msg) { console.log(`[图像优化] ${msg}`); }

async function optimizeLogo() {
  // 中心裁成正方形 → 缩放 → WebP（logo / 浮动球共用一个）
  log('处理 yili.jpg → yili.webp');
  await sharp(join(PUBLIC_DIR, 'yili.jpg'))
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toFile(join(PUBLIC_DIR, 'yili.webp'));

  // favicon：64×64 JPEG（favicon 对 WebP 支持不稳，保留 JPEG）
  log('处理 yili.jpg → yili-small.jpg (favicon)');
  await sharp(join(PUBLIC_DIR, 'yili.jpg'))
    .resize(FAVICON_SIZE, FAVICON_SIZE, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 80 })
    .toFile(join(PUBLIC_DIR, 'yili-small.jpg'));
}

async function optimizeInteractive() {
  for (const [src, out] of Object.entries(INTERACTIVE_FILES)) {
    log(`处理 ${src} → ${out}`);
    await sharp(join(PUBLIC_DIR, src))
      .resize(LIVE2D_SIZE, LIVE2D_SIZE, { fit: 'inside' })
      .webp({ quality: 85 })
      .toFile(join(PUBLIC_DIR, out));
  }
}

async function optimizeIdle() {
  const buffers = [];
  for (let i = 0; i < IDLE_FILES.length; i++) {
    const name = IDLE_FILES[i];
    const out = `mascot-idle-${i}.webp`;
    log(`处理 ${name} → ${out}`);
    const buf = await sharp(join(PUBLIC_DIR, name))
      .resize(LIVE2D_SIZE, LIVE2D_SIZE, { fit: 'inside' })
      .webp({ quality: 85 })
      .toBuffer();
    await sharp(buf).toFile(join(PUBLIC_DIR, out));
    buffers.push(buf);
  }

  // 水平雪碧图：6 帧等宽拼接
  log('拼接 idle 雪碧图 mascot-idle-sprite.webp');
  const meta = await sharp(buffers[0]).metadata();
  const w = meta.width;
  const h = meta.height;
  const sprite = await sharp({
    create: {
      width: w * IDLE_FILES.length,
      height: h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(buffers.map((buf, i) => ({ input: buf, left: i * w, top: 0 })))
    .webp({ quality: 85 })
    .toBuffer();
  await sharp(sprite).toFile(join(PUBLIC_DIR, 'mascot-idle-sprite.webp'));
}

async function main() {
  try {
    await optimizeLogo();
    await optimizeInteractive();
    await optimizeIdle();
    log('完成！');
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    process.exit(1);
  }
}

main();
