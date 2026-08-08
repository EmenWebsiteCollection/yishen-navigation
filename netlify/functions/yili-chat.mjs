// netlify/functions/yili-chat.mjs
// 依力 AI 代理函数 v2 —— 含站内搜索工具调用（Issue #56 二期）
//
// 双模式：
//   云 API 模式：LLM_URL 指向 DeepSeek/OpenAI 兼容端点，需 LLM_API_KEY
//   本地模式：LLM_URL 指向 Ollama（http://localhost:11434/v1/chat/completions），无需 key
//
// 契约：POST { messages, persona } → { reply }（一期兼容，前端零改动）
// 工具：search_works —— LLM 自主决定调用，检索站内作品（Supabase 只读）
import { createClient } from '@supabase/supabase-js';

const ENV = {
  // LLM 端点与模型（Netlify 环境变量可覆盖）
  LLM_URL: process.env.LLM_URL || 'https://api.deepseek.com/chat/completions',
  LLM_API_KEY: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  MODEL: process.env.LLM_MODEL || 'deepseek-chat',
  // Supabase（函数侧独立环境变量，优先；回退 VITE_ 前缀）
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  // 依力人设（默认取内置，可用 YILI_PERSONA 覆盖）
  PERSONA: process.env.YILI_PERSONA || '',
};

const PERSONA_DEFAULT = `你是「依力」，依神网站汇总的看板郎助手。
性格：活泼、口语化、有点俏皮；自称"依力"；偶尔用 emoji 但不过度。
任务：陪用户闲聊，并引导使用站内功能（首页/发现页/想法集中营/搜索）。
推荐内容时给具体入口；不知道的事就大方承认，不要编造。
回复保持简短（2-3 句以内）。
当用户找作品时，使用 search_works 工具在站内检索，再基于结果推荐。`;

const MAX_TOOL_ROUNDS = 2;
const LLM_TIMEOUT_MS = 20000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ---------- 工具定义（OpenAI 兼容 function calling） ----------
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_works',
      description:
        '在站内检索作品（网站/小说/插画/游戏/音乐/视频/摄影/其他）。用户找作品、要推荐、问"有没有xxx"时使用。返回匹配作品的标题、类型、点赞数。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词，如"科幻""学习""插画"' },
          work_type: {
            type: 'string',
            enum: ['website', 'novel', 'illustration', 'game', 'music', 'video', 'photo', 'other', ''],
            description: '作品类型过滤，不区分时传空字符串',
          },
          limit: { type: 'number', description: '返回条数，默认 5，最多 8' },
        },
        required: ['keyword'],
      },
    },
  },
];

// ---------- 工具执行 ----------
async function searchWorks(keyword, workType = '', limit = 5) {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON) {
    return { error: '站内搜索未配置（缺少 SUPABASE_URL / SUPABASE_ANON_KEY）' };
  }
  const n = Math.min(Math.max(Number(limit) || 5, 1), 8);
  const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON);
  let query = supabase
    .from('works')
    .select('id,title,url,work_type,like_count')
    .ilike('title', `%${String(keyword).slice(0, 50)}%`)
    .order('like_count', { ascending: false })
    .limit(n);
  if (workType) query = query.eq('work_type', workType);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return {
    results: (data || []).map((w) => ({
      id: w.id,
      title: w.title,
      type: w.work_type,
      likes: w.like_count,
      url: w.url,
    })),
  };
}

async function executeTool(name, rawArgs) {
  let args = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: '参数解析失败' };
  }
  if (name === 'search_works') {
    return searchWorks(args.keyword, args.work_type || '', args.limit);
  }
  return { error: `未知工具: ${name}` };
}

// ---------- LLM 调用（OpenAI 兼容） ----------
async function callLLM(messages) {
  const headers = { 'Content-Type': 'application/json' };
  if (ENV.LLM_API_KEY) headers.Authorization = `Bearer ${ENV.LLM_API_KEY}`;
  const res = await fetch(ENV.LLM_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ENV.MODEL,
      messages,
      tools: TOOLS,
      temperature: 0.8,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message || null;
}

// ---------- 主流程：工具循环 ----------
async function runAgent(messages, persona) {
  const system = persona || ENV.PERSONA || PERSONA_DEFAULT;
  const history = [{ role: 'system', content: system }, ...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const msg = await callLLM(history);
    if (!msg) return '依力开小差了，稍后再试～';

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      history.push(msg); // assistant 的 tool_calls 消息
      for (const tc of msg.tool_calls) {
        const result = await executeTool(tc.function?.name, tc.function?.arguments);
        history.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue; // 下一轮让模型基于工具结果组织回复
    }

    return (msg.content || '').trim() || '……';
  }

  return '依力绕晕了，换个问法试试？';
}

// ---------- 入口 ----------
export default async (req) => {
  // 1) 本地模式（Ollama）允许无 key；云模式必须有 key
  const isLocal = /localhost|127\.0\.0\.1|11434/.test(ENV.LLM_URL);
  if (!ENV.LLM_API_KEY && !isLocal) {
    return json({ reply: '依力的大脑还没接好（缺少 LLM_API_KEY，详见使用说明）' }, 503);
  }

  // 2) 解析请求
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ reply: '你说得太快了，我没听清～' }, 400);
  }
  const { messages = [], persona = '' } = body;
  if (!Array.isArray(messages)) {
    return json({ reply: '消息格式不对哦～' }, 400);
  }

  // 3) 跑 agent
  try {
    const reply = await runAgent(messages, persona);
    return json({ reply });
  } catch (err) {
    console.error('yili-chat error:', err);
    return json({ reply: '依力有点忙，稍等一下～' }, 502);
  }
};
