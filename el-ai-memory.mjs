// el-ai-memory.mjs —— 依力 AI 作品记忆更新器
// 每 3 小时运行一次：读取新上传作品 → LLM 阅读摘要 → 追加到 el-ai-memory.md
// 运行: node --env-file=.env el-ai-memory.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const MEMORY_FILE = fileURLToPath(new URL('./el-ai-memory.md', import.meta.url));
const STATE_FILE = fileURLToPath(new URL('./.el-ai-memory-state.json', import.meta.url));

// ---- 环境变量 ----
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const LLM_URL = process.env.LLM_URL || 'https://api.deepseek.com/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

const BATCH_SIZE = 20; // 单批最多阅读数量，避免单次请求过大

// ---- 读取上次检查时间 ----
async function readState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastCheck: null }; // 首次运行：全量阅读
  }
}

// ---- 查询新作品（分页循环，全量补读） ----
async function fetchNewWorks(supabase, lastCheck) {
  const all = [];
  const from = 0;
  let offset = from;
  // 全量模式最多读 300 条（防失控）；增量模式只读最近 BATCH_SIZE 条
  const maxTotal = lastCheck ? BATCH_SIZE : 300;
  while (all.length < maxTotal) {
    let q = supabase
      .from('works')
      .select('id,title,description,url,work_type,created_at,user_id')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (lastCheck) q = q.gt('created_at', lastCheck);
    const { data, error } = await q;
    if (error) throw new Error('查询作品失败: ' + error.message);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
  return all;
}

// ---- LLM 阅读并生成记忆条目 ----
async function summarizeWorks(works) {
  const list = works.map((w, i) => `${i + 1}. 标题: ${w.title}\n   类型: ${w.work_type || '未分类'}\n   描述: ${(w.description || '(无描述)').slice(0, 600)}\n   链接: ${w.url || '(无)'}`).join('\n\n');

  const prompt = `你是依力 AI 的资料员。请阅读下面 ${works.length} 个新上传的作品信息，为每个作品生成一段简洁的中文记忆条目。

要求：
- 每个条目一句话概括作品是什么、核心功能/亮点（80字以内）
- 提炼 1-3 个标签（如 #AI工具 #学习 #游戏）
- 语气客观，只写从信息中能确定的内容，不要编造
- 严格按以下格式输出，不要有多余解释：

## 2026-08-08 新收录
- 《标题1》 | 一句话摘要 | 标签：#A #B
- 《标题2》 | 一句话摘要 | 标签：#C

作品信息：
${list}`;

  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ---- 追加到记忆文件 ----
// all 模式（--all）：重建整个记忆库；否则追加
async function appendMemory(section, isAll) {
  const header =
    '# 依力 AI 作品记忆库\n\n> 自动记录：每 3 小时扫描新上传作品并生成记忆条目。\n> 本文件供依力 AI 参考站内作品信息，由 el-ai-memory.mjs 自动维护。\n\n---\n\n';
  if (isAll) {
    await writeFile(MEMORY_FILE, header + section + '\n', 'utf8');
    return;
  }
  let existing = '';
  try {
    existing = await readFile(MEMORY_FILE, 'utf8');
  } catch {
    // 文件不存在，创建新文件
  }
  await writeFile(MEMORY_FILE, existing + '\n' + section + '\n', 'utf8');
}

// ---- 同步到线上（Netlify Blobs，经 el-memory 函数） ----
async function syncToRemote() {
  const url = process.env.EL_MEMORY_SYNC_URL;
  const token = process.env.EL_MEMORY_TOKEN;
  if (!url || !token) {
    console.log('  (未配置 EL_MEMORY_SYNC_URL/EL_MEMORY_TOKEN，跳过线上同步)');
    return;
  }
  try {
    const content = await readFile(MEMORY_FILE, 'utf8');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`同步失败 HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
    console.log('  ✅ 已同步到线上依力记忆');
  } catch (err) {
    console.error('  ⚠️ 线上同步失败（不影响本地文件）:', err.message);
  }
}

// ---- 主流程 ----
async function main() {
  const isAll = process.argv.includes('--all');
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('缺少 SUPABASE 配置');
  if (!LLM_API_KEY) throw new Error('缺少 LLM_API_KEY');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

  const state = await readState();
  // --all 全量重建（忽略 lastCheck，读全部作品）；否则只读上次检查后的新作品
  const works = await fetchNewWorks(supabase, isAll ? null : state.lastCheck);
  const now = new Date().toISOString();

  if (works.length === 0) {
    console.log(`[${now}] 无新作品，跳过`);
    await writeFile(STATE_FILE, JSON.stringify({ lastCheck: now }), 'utf8');
    return;
  }

  console.log(`[${now}] ${isAll ? '全量重建' : '增量'}：发现 ${works.length} 个作品，开始阅读...`);
  // 分批阅读：每批 BATCH_SIZE 个，避免单次 LLM 输出超限被截断
  let section = '';
  for (let i = 0; i < works.length; i += BATCH_SIZE) {
    const batch = works.slice(i, i + BATCH_SIZE);
    console.log(`  批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(works.length / BATCH_SIZE)}：${batch.length} 个...`);
    const chunk = await summarizeWorks(batch);
    section += (section ? '\n' : '') + chunk;
  }
  await appendMemory(section, isAll);
  await writeFile(STATE_FILE, JSON.stringify({ lastCheck: now }), 'utf8');
  console.log(`✅ 已写入 ${works.length} 条记忆到 el-ai-memory.md`);
  await syncToRemote();
  console.log('--- 生成内容预览 ---\n' + section.slice(0, 500));
}

main().catch((err) => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
