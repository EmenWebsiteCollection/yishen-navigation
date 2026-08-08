// src/services/workDeploy.js
// Issue #13：拖拽文件一键部署（Supabase Storage 静态托管 MVP）
// 上传 zip → JSZip 解压 → 逐文件上传到 work_deploys 桶（路径 work_id/...）→
// 自动识别入口（根目录 index.html 优先）→ 写回 works.deploy_url 预览地址。
//
// 约束（UI 需提示）：仅纯静态站点（HTML/CSS/JS）；不支持后端/数据库；
// SPA 子路由刷新会 404（建议作品内用 hash 路由）；zip ≤50MB。
import JSZip from 'jszip';
import { supabase } from './supabase.js';

const BUCKET = 'work_deploys';
const MAX_ZIP_MB = 50;
const MAX_SINGLE_FILE_MB = 10;

// 允许的扩展名（与存储桶 MIME 白名单对齐）
const ALLOWED_EXT = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'json', 'txt', 'md',
  'png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ico',
  'woff', 'woff2', 'ttf', 'mp4', 'webm', 'mp3', 'ogg',
]);

// 明确禁止的可执行/服务端文件
const BLOCKED_EXT = new Set([
  'exe', 'msi', 'bat', 'cmd', 'sh', 'php', 'py', 'rb', 'pl', 'jar', 'war',
  'class', 'dll', 'so', 'dylib', 'sql', 'ps1', 'vbs', 'jsp', 'asp', 'aspx',
]);

const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

export const deployPreviewUrl = (workId, entry) => {
  if (!workId) return '';
  const e = entry && entry !== 'index.html' ? `/${entry}` : '';
  return `${supabase.supabaseUrl}/storage/v1/object/public/${BUCKET}/${workId}${e}`;
};

export const validateDeployFile = (file) => {
  if (!file) throw new Error('请选择 zip 文件');
  if (!/\.zip$/i.test(file.name)) throw new Error('只支持 .zip 压缩包');
  if (file.size > MAX_ZIP_MB * 1024 * 1024) throw new Error(`压缩包不能超过 ${MAX_ZIP_MB}MB`);
};

// 遍历 zip 条目，返回 { path, blob, size } 白名单文件
async function collectFiles(zip) {
  const files = [];
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  if (names.length === 0) throw new Error('压缩包是空的');
  if (names.length > 500) throw new Error('压缩包内文件过多（最多 500 个）');

  for (const name of names) {
    const clean = name.replace(/\\/g, '/');
    const ext = extOf(clean);
    if (BLOCKED_EXT.has(ext)) throw new Error(`包含不允许的文件类型：${name}`);
    if (!ALLOWED_EXT.has(ext)) continue; // 非白名单静默跳过（如 .DS_Store）
    const entry = zip.files[name];
    const blob = await entry.async('blob');
    if (blob.size > MAX_SINGLE_FILE_MB * 1024 * 1024) {
      throw new Error(`单个文件不能超过 ${MAX_SINGLE_FILE_MB}MB：${name}`);
    }
    files.push({ path: clean, blob, size: blob.size });
  }
  if (files.length === 0) throw new Error('压缩包里没有可部署的静态文件');
  return files;
}

// 识别入口：根目录 index.html 优先，否则第一个 .html
function pickEntry(files) {
  const rootIndex = files.find((f) => /^index\.html?$/i.test(f.path));
  if (rootIndex) return rootIndex.path;
  const html = files.find((f) => /\.html?$/i.test(f.path));
  if (html) return html.path;
  throw new Error('未找到入口文件（需要 index.html 或任意 .html）');
}

export async function uploadWorkDeploy(workId, file, userId) {
  if (!userId) throw new Error('请先登录');
  if (!workId) throw new Error('缺少作品 ID');
  validateDeployFile(file);

  // 权限：仅作品作者（或管理员）可上传部署
  const { data: work, error: workErr } = await supabase
    .from('works')
    .select('id, user_id, deploy_url')
    .eq('id', workId)
    .maybeSingle();
  if (workErr) throw workErr;
  if (!work) throw new Error('作品不存在');
  if (work.user_id !== userId) throw new Error('只有作品作者可以上传部署文件');

  // 解压 + 收集
  const zip = await JSZip.loadAsync(file);
  const files = await collectFiles(zip);
  const entry = pickEntry(files);

  // 逐文件上传（upsert 覆盖旧版本）
  for (const f of files) {
    const path = `${workId}/${f.path}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, f.blob, { contentType: f.blob.type || 'application/octet-stream', upsert: true });
    if (error) throw new Error(`上传失败：${f.path}（${error.message}）`);
  }

  // 写回 works
  const url = deployPreviewUrl(workId, entry);
  const { error: upErr } = await supabase
    .from('works')
    .update({ deploy_url: url, deploy_updated_at: new Date().toISOString() })
    .eq('id', workId);
  if (upErr) throw upErr;

  return { deploy_url: url, entry, files: files.length };
}

export async function deleteWorkDeploy(workId, userId) {
  if (!userId) throw new Error('请先登录');
  if (!workId) throw new Error('缺少作品 ID');
  const { data: work, error: workErr } = await supabase
    .from('works')
    .select('id, user_id')
    .eq('id', workId)
    .maybeSingle();
  if (workErr) throw workErr;
  if (!work) throw new Error('作品不存在');
  if (work.user_id !== userId) throw new Error('只有作品作者可以删除部署');

  const { data: list, error: listErr } = await supabase.storage.from(BUCKET).list(workId, { limit: 500 });
  if (listErr) throw listErr;
  if (list && list.length > 0) {
    const paths = list.map((f) => `${workId}/${f.name}`);
    const { error: delErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (delErr) throw delErr;
  }
  const { error: upErr } = await supabase
    .from('works')
    .update({ deploy_url: null, deploy_updated_at: null })
    .eq('id', workId);
  if (upErr) throw upErr;
  return { ok: true };
}
