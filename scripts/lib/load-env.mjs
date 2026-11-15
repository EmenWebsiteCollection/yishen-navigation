// scripts/lib/load-env.mjs
// 本地脚本用：把仓库根 .env.local 读进 process.env（不覆盖已存在的变量）。
// VITE_ 前缀的 Supabase 凭据同时映射到服务端命名（SUPABASE_URL / SUPABASE_ANON_KEY），
// 这样 Worker 里的函数在本地跑起来和线上读取方式一致。

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function loadEnvLocal() {
  let raw;
  try {
    raw = await readFile(join(root, '.env.local'), 'utf8');
  } catch {
    return false;
  }

  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, value] = m;
    const clean = value.replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = clean;
    if (key === 'VITE_SUPABASE_URL' && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = clean;
    if (key === 'VITE_SUPABASE_ANON_KEY' && !process.env.SUPABASE_ANON_KEY) {
      process.env.SUPABASE_ANON_KEY = clean;
    }
  }
  return true;
}
