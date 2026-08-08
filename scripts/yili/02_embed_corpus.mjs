// scripts/yili/02_embed_corpus.mjs
// 依力语料嵌入：corpus_chunks.json → DashScope text-embedding-v4 → Supabase yili_corpus
//
// 前置：
//   .env.local 或环境变量需提供：
//     DASHSCOPE_API_KEY          阿里云百炼 API Key
//     SUPABASE_URL               如 https://naaczfnskkpsujdfwurj.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY  Supabase service_role key（控制台 → Settings → API）
//   （若缺 SUPABASE_SERVICE_ROLE_KEY，脚本拒绝执行，避免用 anon 写库）
//
// 用法：node scripts/yili/02_embed_corpus.mjs
// 幂等：可重复执行（按 doc_id+chunk_index upsert 覆盖）
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const CHUNKS_JSON = fileURLToPath(new URL('./corpus_chunks.json', import.meta.url));
const ENV_LOCAL = new URL('../../.env.local', import.meta.url).pathname;
const EMBED_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
const MGMT_URL = 'https://api.supabase.com/v1/projects/{ref}/database/query';
const BATCH = 25;
const MAX_RETRY = 3;

function loadEnvLocal() {
  const env = {};
  try {
    const text = readFileSync(ENV_LOCAL, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* 无 .env.local 时忽略 */ }
  return env;
}

function env(name) {
  const local = loadEnvLocal();
  return process.env[name] || local[name] || '';
}

async function embedBatch(texts, apiKey) {
  const body = {
    model: 'text-embedding-v4',
    input: texts,
    parameters: { dimension: 1024, text_type: 'document' },
  };
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await fetch(EMBED_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }
      const data = await res.json();
      const embeddings = (data?.output?.embeddings || []).slice().sort((a, b) => a.text_index - b.text_index);
      return {
        vectors: embeddings.map((e) => e.embedding),
        totalTokens: data?.usage?.total_tokens || 0,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRY) {
        const delay = 1500 * attempt;
        console.log(`  嵌入批次失败（${err.message}），${delay / 1000}s 后重试 ${attempt}/${MAX_RETRY}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const apiKey = env('DASHSCOPE_API_KEY');
  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const mgmtToken = env('SUPABASE_MGMT_TOKEN');
  const supabaseRef = env('SUPABASE_REF');

  if (!apiKey) {
    console.error('缺少 DASHSCOPE_API_KEY（阿里云百炼）。请在 .env.local 或环境变量中配置后重试。');
    process.exit(1);
  }
  // 入库凭据二选一：service role 直连 或 管理令牌（经 Management API 执行 upsert SQL）
  if (!((supabaseUrl && serviceKey) || (mgmtToken && supabaseRef))) {
    console.error('缺少入库凭据：请配置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY，或 SUPABASE_MGMT_TOKEN + SUPABASE_REF（管理令牌模式）。');
    process.exit(1);
  }
  if (!existsSync(CHUNKS_JSON)) {
    console.error(`未找到切块产物：${CHUNKS_JSON}，请先运行 01_chunk_corpus.mjs`);
    process.exit(1);
  }

  const chunks = JSON.parse(readFileSync(CHUNKS_JSON, 'utf8'));
  console.log(`共 ${chunks.length} 块，开始嵌入（批大小 ${BATCH}）…`);

  const useMgmt = !!mgmtToken && !!supabaseRef;
  const supabase = useMgmt || !serviceKey ? null : createClient(supabaseUrl, serviceKey);
  let totalTokens = 0;
  let okCount = 0;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const { vectors, totalTokens: tt } = await embedBatch(batch.map((c) => c.content), apiKey);
    totalTokens += tt;

    if (vectors.length !== batch.length) {
      throw new Error(`嵌入返回数量不符：${vectors.length} vs ${batch.length}`);
    }

    const rows = batch.map((c, j) => ({
      doc_id: c.doc_id,
      chunk_index: c.chunk_index,
      content: c.content,
      token_count: c.token_count,
      source_file: c.source_file,
      embedding: vectors[j],
    }));

    if (useMgmt) {
      // 管理令牌模式：经 Management API 执行 upsert SQL（JSON 内联，幂等覆盖）
      const jsonArr = JSON.stringify(rows);
      const esc = jsonArr.replace(/'/g, "''");
      const sql = `select public.upsert_yili_chunks('${esc}'::jsonb);`;
      const res = await fetch(MGMT_URL.replace('{ref}', supabaseRef), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 Chrome/120.0',
        },
        body: JSON.stringify({ query: sql }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`管理令牌入库失败 HTTP ${res.status}: ${detail.slice(0, 300)}`);
      }
    } else {
      // service role 直连：优先 RPC（jsonb → vector 显式转换）；失败则表 upsert
      const rpcRes = await supabase.rpc('upsert_yili_chunks', {
        p_chunks: rows.map((r) => ({ ...r, embedding: `[${r.embedding.join(',')}]` })),
      });
      if (rpcRes.error) {
        console.log(`  RPC upsert 失败（${rpcRes.error.message}），尝试表 upsert…`);
        const tbRes = await supabase
          .from('yili_corpus')
          .upsert(rows.map((r) => ({ ...r, embedding: `[${r.embedding.join(',')}]` })), {
            onConflict: 'doc_id,chunk_index',
          });
        if (tbRes.error) throw new Error(`入库失败: ${tbRes.error.message}`);
      }
    }

    console.log(`  批次 ${i / BATCH + 1} 完成（${batch.length} 块，本批 token ${tt}）`);
    okCount += batch.length;
    await sleep(150); // 轻限速，避免触发 DashScope 频率限制
  }

  console.log('----------------------------------------');
  console.log(`完成：${okCount}/${chunks.length} 块已入库，累计 token ≈ ${totalTokens}`);
}

main().catch((err) => {
  console.error('嵌入失败:', err.message);
  process.exit(1);
});

