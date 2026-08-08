// src/services/yiliRetrieval.js
// 依力 AI 3.0 检索运行时服务（供 netlify/functions/yili-chat.mjs 使用）
//   - embedText：DashScope text-embedding-v4 查询嵌入（无 key 时返回 null）
//   - getYiliSamples：调 get_yili_samples RPC（关键词 token + 向量 RRF）
//   - getStyleBlock：直接产出可注入 system 的风格样本块
import { tokenizeKeyword, buildStyleBlock, pickStyleSamples } from './yili-retrieval-logic.mjs';

const EMBED_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings';

// 查询嵌入（text_type=query）。无 key/失败返回 null，绝不抛错阻断主流程。
export async function embedText(text, apiKey, { dimension = 1024 } = {}) {
  if (!apiKey || !text || !String(text).trim()) return null;
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'text-embedding-v4',
      input: [String(text).slice(0, 500)],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn(`[yiliRetrieval] embed HTTP ${res.status}: ${detail.slice(0, 120)}`);
    return null;
  }
  const data = await res.json();
  return data?.data?.[0]?.embedding || null; // OpenAI 兼容响应格式
}

// 混合检索：关键词（tokenizeKeyword）+ 向量（embedText）→ RPC RRF 融合
export async function getYiliSamples(query, { supabase, limit = 6, apiKey } = {}) {
  if (!query || !String(query).trim()) return { samples: [], error: null };
  const tokens = tokenizeKeyword(query);
  let embedding = null;
  if (apiKey) {
    try {
      embedding = await embedText(query, apiKey);
    } catch {
      embedding = null; // 向量路失败 → 纯关键词兜底
    }
  }
  const params = { p_query: String(query), p_tokens: tokens, p_limit: limit };
  if (embedding) params.p_embedding = `[${embedding.join(',')}]`;
  const { data, error } = await supabase.rpc('get_yili_samples', params);
  if (error) return { samples: [], error };
  return { samples: pickStyleSamples(data || [], { limit }), error: null };
}

// 直接产出风格样本块（空样本返回空串，调用方据此跳过注入）
export async function getStyleBlock(query, { supabase, limit = 5, apiKey } = {}) {
  const { samples, error } = await getYiliSamples(query, { supabase, limit, apiKey });
  return { block: buildStyleBlock(samples), samples, error };
}


