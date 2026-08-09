// netlify/functions/yili-chat.mjs
// 依力 AI 代理函数 v3 —— 语料风格注入 + 全站工具 + 个性化记忆（不微调）
//
// 相对 v2 的变更：
//   - 风格 RAG：按用户消息混合检索（关键词+向量 RRF）依力课程原话样本，
//     注入 system 的 <yili_samples> 区，让模型照着依力的方式说话
//   - 工具扩展：search_works / get_discovery_rail / get_work / get_ideas /
//     get_creator / get_platform_guide，返回结构化 actions（work_card/idea_card/guide_card）
//   - 个性化记忆：入参 userId+idToken 时读取/写入 user_memories（RLS 仅本人）
//   - 降级链：LLM 失败→agentFallback；检索/记忆失败→跳过注入，绝不让单点故障杀死聊天
//
// 契约：POST { messages, persona?, userId?, idToken? } → { reply, actions }
//   actions: [{ type:'work_card'|'idea_card'|'guide_card', workId?, ideaId?, title?, to?, label? }]
//   老前端忽略 actions 仍可用（兼容）。
import { createClient } from '@supabase/supabase-js';
import {
  tokenizeKeyword,
  buildStyleBlock,
  detectPreferenceSignals,
} from '../../src/services/yili-retrieval-logic.mjs';
import { getYiliSamples } from '../../src/services/yiliRetrieval.js';
import { buildStyleDnaBlock } from '../../src/services/yili-style-dna.js';

export { tokenizeKeyword }; // 向后兼容导出（如外部测试引用）

const ENV = {
  LLM_URL: process.env.LLM_URL || 'https://api.deepseek.com/chat/completions',
  LLM_API_KEY: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  MODEL: process.env.LLM_MODEL || 'deepseek-chat',
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || '', // 可选：风格向量检索
  PERSONA: process.env.YILI_PERSONA || '',
};

const PERSONA_DEFAULT = `你是「依力」，依神网站汇总的看板郎助手。
性格：活泼、口语化、有点俏皮；自称"依力"；偶尔用 emoji 但不过度。
任务：陪用户闲聊，并引导使用站内功能（首页/发现页/想法集中营/搜索）。
推荐内容时给具体入口；不知道的事就大方承认，不要编造。
回复保持简短（2-3 句以内）。
当用户找作品时，使用 search_works 或 get_discovery_rail 工具在站内检索，再基于结果推荐。`;

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
  {
    type: 'function',
    function: {
      name: 'get_discovery_rail',
      description:
        '拉取发现页某个内容入口的作品列表（最新发布/本周新锐/编辑精选/小众宝藏/正在成长/零评论/同类型/收藏偏好/关注动态/每日随机）。用户要"推荐/看看有什么/新作品/宝藏"时使用。',
      parameters: {
        type: 'object',
        properties: {
          rail: {
            type: 'string',
            enum: ['latest', 'rising', 'featured', 'underrated', 'growing', 'zero_comment', 'similar', 'favorites', 'following', 'random'],
            description: '内容入口，默认 latest',
          },
          limit: { type: 'number', description: '返回条数，默认 5，最多 8' },
        },
        required: ['rail'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_work',
      description: '按 ID 获取单个作品的详细信息（标题/类型/描述/统计/作者）。用户提到具体作品名或给出作品链接时使用。',
      parameters: {
        type: 'object',
        properties: {
          workId: { type: 'string', description: '作品 UUID' },
        },
        required: ['workId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ideas',
      description: '拉取想法集中营的高票想法列表。用户问"有什么想法/创意/点子/建议"时使用。',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '返回条数，默认 5，最多 8' },
        },
        required: ['limit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_creator',
      description: '按用户名查找创作者主页信息（简介/统计/代表作品）。用户问"某个人/创作者/大佬"时使用。',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: '创作者用户名' },
        },
        required: ['username'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_platform_guide',
      description: '回答站内功能/板块怎么用（首页/发现/想法/投稿/联系/个人中心）。用户问"怎么用/在哪里/入口"时使用。',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['home', 'discover', 'ideas', 'submit', 'contact', 'profile'],
            description: '话题，如 submit=投稿',
          },
        },
        required: ['topic'],
      },
    },
  },
];

// ---------- 工具执行 ----------

// 中文简单分词（已移至 yili-retrieval-logic.mjs，此处仅保留原函数导出兼容）
const STOP_WORDS = new Set(['的', '了', '吗', '呢', '吧', '啊', '哦', '嗯', '呀', '嘛', '什么', '怎么', '怎样', '哪些', '有没有', '推荐', '找', '搜', '查', '看看', '一下', '几个', '一些', '一个', '想要', '想', '帮']);

function makeAnonClient() {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON) return null;
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON);
}

export async function searchWorks(keyword, workType = '', limit = 5) {
  const supabase = makeAnonClient();
  if (!supabase) return { error: '站内搜索未配置（缺少 SUPABASE_URL / SUPABASE_ANON_KEY）' };
  const n = Math.min(Math.max(Number(limit) || 5, 1), 8);
  const tokens = tokenizeKeyword(keyword);
  const base = () =>
    supabase
      .from('works_with_likes')
      .select('id,title,url,work_type,like_count')
      .order('like_count', { ascending: false })
      .limit(n);

  let data = null;
  let error = null;

  if (tokens.length > 0) {
    const orParts = [];
    for (const t of tokens) orParts.push(`title.ilike.%${t}%,description.ilike.%${t}%`);
    const r = await base().or(orParts.join(','));
    data = r.data;
    error = r.error;
    if (!error && data && data.length > 0) {
      return {
        results: data.map((w) => ({ id: w.id, title: w.title, type: w.work_type, likes: w.like_count, url: w.url })),
      };
    }
  }

  if (!error && (!data || data.length === 0)) {
    let q = base();
    if (workType) q = q.eq('work_type', workType);
    const r = await q;
    data = r.data;
    error = r.error;
  }

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

async function toolDiscoveryRail(rail, limit) {
  const supabase = makeAnonClient();
  if (!supabase) return { error: '站内检索未配置' };
  const n = Math.min(Math.max(Number(limit) || 5, 1), 8);
  const { data, error } = await supabase.rpc('get_discovery_rail', {
    p_rail: String(rail || 'latest'),
    p_limit: n,
    p_user_id: null,
    p_work_id: null,
  });
  if (error) return { error: error.message };
  return {
    results: (data || []).map((w) => ({
      id: w.id,
      title: w.title,
      type: w.work_type,
      likes: w.like_count,
      comments: w.comment_count,
      url: w.url || '',
    })),
  };
}

async function toolGetWork(workId) {
  const supabase = makeAnonClient();
  if (!supabase) return { error: '站内检索未配置' };
  if (!workId) return { error: '缺少 workId' };
  const { data, error } = await supabase
    .from('works_discovery')
    .select('id,title,work_type,url,description,like_count,comment_count,favorite_count,username,image_url')
    .eq('id', workId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: '未找到该作品' };
  return {
    work: {
      id: data.id,
      title: data.title,
      type: data.work_type,
      url: data.url || '',
      description: data.description || '',
      likes: data.like_count,
      comments: data.comment_count,
      favorites: data.favorite_count,
      author: data.username,
      image: data.image_url,
    },
  };
}

async function toolGetIdeas(limit) {
  const supabase = makeAnonClient();
  if (!supabase) return { error: '站内检索未配置' };
  const n = Math.min(Math.max(Number(limit) || 5, 1), 8);
  const { data, error } = await supabase
    .from('ideas_with_stats')
    .select('id,title,category,status,vote_count,comment_count')
    .order('vote_count', { ascending: false })
    .limit(n);
  if (error) return { error: error.message };
  return {
    results: (data || []).map((i) => ({
      id: i.id,
      title: i.title,
      category: i.category,
      status: i.status,
      votes: i.vote_count,
    })),
  };
}

async function toolGetCreator(username) {
  const supabase = makeAnonClient();
  if (!supabase) return { error: '站内检索未配置' };
  if (!username) return { error: '缺少用户名' };
  const { data: profile, error: pe } = await supabase
    .from('profiles')
    .select('id,username,bio,avatar_url')
    .ilike('username', `%${String(username).trim()}%`)
    .limit(1)
    .maybeSingle();
  if (pe) return { error: pe.message };
  if (!profile) return { error: '未找到该创作者' };
  const { data: stats } = await supabase.rpc('get_creator_stats', { p_user_id: profile.id }).catch(() => ({ data: null }));
  const { data: works } = await supabase
    .from('works_discovery')
    .select('id,title,work_type,like_count')
    .eq('user_id', profile.id)
    .order('like_count', { ascending: false })
    .limit(5);
  return {
    profile: { id: profile.id, username: profile.username, bio: profile.bio || '' },
    stats: stats || null,
    works: (works || []).map((w) => ({ id: w.id, title: w.title, type: w.work_type, likes: w.like_count })),
  };
}

const PLATFORM_GUIDES = {
  home: { label: '逛首页', to: '/', text: '首页是网站导航，按类型收录各类作品。' },
  discover: { label: '去发现页', to: '/discover', text: '发现页有最新/本周新锐/编辑精选/小众宝藏/正在成长/零评论/关注动态/收藏偏好等多个入口，还有「今天看点不一样的」随机作品。' },
  ideas: { label: '想法集中营', to: '/ideas', text: '想法集中营可以发布创意、投票、评论；想法被实现后会回链作品并点亮「已实现」。' },
  submit: { label: '去投稿', to: '/create', text: '投稿页可以发布网站/小说/插画/游戏/音乐/视频/摄影等作品，网站型需要填网址。' },
  contact: { label: '联系我们', to: '/contact', text: '联系页有反馈与合作入口。' },
  profile: { label: '个人中心', to: '/profile', text: '个人中心管理我的作品、我的收藏、我的想法与设置。' },
};

function toolPlatformGuide(topic) {
  const g = PLATFORM_GUIDES[String(topic || '').trim()];
  if (!g) return { error: '未知话题' };
  return { guide: g };
}

async function executeTool(name, rawArgs) {
  let args = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: '参数解析失败' };
  }
  switch (name) {
    case 'search_works':
      return searchWorks(args.keyword, args.work_type || '', args.limit);
    case 'get_discovery_rail':
      return toolDiscoveryRail(args.rail, args.limit);
    case 'get_work':
      return toolGetWork(args.workId);
    case 'get_ideas':
      return toolGetIdeas(args.limit);
    case 'get_creator':
      return toolGetCreator(args.username);
    case 'get_platform_guide':
      return toolPlatformGuide(args.topic);
    default:
      return { error: `未知工具: ${name}` };
  }
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
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message || null;
  if (msg && msg.content == null) msg.content = '';
  return msg;
}

// ---------- 消息归一化 ----------
function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((m) => {
    let role = m.role;
    if (role === 'yili') role = 'assistant';
    if (!['system', 'user', 'assistant'].includes(role)) role = 'user';
    return { role, content: String(m.content ?? '') };
  });
}

// ---------- 站内记忆库（Blobs，作品摘要 + 网站结构） ----------
const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
let memoryCache = null;
let memoryCacheAt = 0;

async function loadMemory() {
  const now = Date.now();
  if (memoryCache && now - memoryCacheAt < MEMORY_CACHE_TTL_MS) return memoryCache;
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('el-memory');
    const content = await store.get('memory.md', { type: 'text' });
    memoryCache = (content || '').trim();
    memoryCacheAt = now;
    return memoryCache;
  } catch {
    return '';
  }
}

// ---------- 个性化记忆（Supabase user_memories，RLS 仅本人） ----------
const MEMORY_MAX = 3000;
const MEMORY_PREFIX = { like: '喜欢', identity: '身份', doing: '在做', want: '想' };

function makeUserClient(idToken) {
  if (!idToken || !ENV.SUPABASE_URL || !ENV.SUPABASE_ANON) return null;
  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${idToken}` } },
  });
}

async function loadUserMemory(userClient, userId) {
  if (!userClient || !userId) return null;
  try {
    const { data } = await userClient
      .from('user_memories')
      .select('memory_text, preferences')
      .eq('user_id', userId)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

function mergeMemory(existing, signals) {
  const lines = existing ? String(existing).split('\n').filter(Boolean) : [];
  const seen = new Set(lines);
  const prefs = { likes: [], doing: [] };
  for (const s of signals) {
    const prefix = MEMORY_PREFIX[s.type] || '';
    const line = prefix ? `${prefix}：${s.text}` : s.text;
    if (prefix && !seen.has(line)) {
      lines.push(line);
      seen.add(line);
    }
    if (s.type === 'like') prefs.likes.push(s.text);
    if (s.type === 'doing') prefs.doing.push(s.text);
  }
  return {
    memory_text: lines.join('\n').slice(0, MEMORY_MAX),
    preferences: prefs,
  };
}

async function saveUserMemory(userClient, userId, memoryText, preferences) {
  if (!userClient || !userId) return;
  try {
    await userClient.rpc('save_user_memory', {
      p_user_id: userId,
      p_memory_text: memoryText,
      p_preferences: preferences || {},
    });
  } catch {
    // 记忆写入失败静默降级
  }
}

// ---------- 主流程：工具循环 ----------
async function runAgent(messages, { persona = '', userId = null, idToken = null } = {}) {
  const system = persona || ENV.PERSONA || PERSONA_DEFAULT;
  const userClient = makeUserClient(idToken);
  const lastUser = [...messages].reverse().find((m) => m.role === 'user' || m.role === 'yili');
  const query = String(lastUser?.content || '');

  // 1) 风格样本注入（依力原话，混合检索）
  let styleBlock = '';
  if (query) {
    const supabase = makeAnonClient();
    if (supabase) {
      try {
        const { block } = await getYiliSamples(query, {
          supabase,
          limit: 6,
          apiKey: ENV.DASHSCOPE_API_KEY,
        });
        styleBlock = block;
      } catch {
        styleBlock = ''; // 检索失败 → 跳过注入
      }
    }
  }

  // 2) 个性化记忆读取
  let userMemory = null;
  if (userClient && userId) userMemory = await loadUserMemory(userClient, userId);

  // 3) 站内记忆库（Blobs）
  const memory = await loadMemory();

  const parts = [system];
  if (styleBlock) parts.push(`【依力说话风格】\n${styleBlock}`);
  if (userMemory?.memory_text) {
    parts.push(
      `【用户记忆】以下是这位用户跟你说过的重要信息，回答时自然带上（不要逐条复述）：\n${String(userMemory.memory_text).slice(0, 3000)}`
    );
  }
  if (memory) {
    parts.push(
      `【站内记忆库】以下是站内已收录作品的摘要与网站结构，回答站内作品/板块问题时优先参考：\n${memory.slice(0, 12000)}\n\n（以上记忆库由每 3 小时自动更新，若与用户问题无关可忽略）`
    );
  }
  const systemWithContext = parts.join('\n\n');
  const history = [{ role: 'system', content: systemWithContext }, ...normalizeMessages(messages)];
  const executedTools = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const msg = await callLLM(history);
    if (!msg) return { reply: '依力开小差了，稍后再试～', actions: [] };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      history.push(msg);
      for (const tc of msg.tool_calls) {
        const result = await executeTool(tc.function?.name, tc.function?.arguments);
        executedTools.push({ name: tc.function?.name, data: result });
        history.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    const reply = (msg.content || '').trim() || '……';
    // 4) 偏好信号 → 写入记忆（对话结束时机）
    if (userClient && userId && query) {
      const signals = detectPreferenceSignals(query);
      if (signals.length > 0) {
        const merged = mergeMemory(userMemory?.memory_text || '', signals);
        const changed = merged.memory_text !== (userMemory?.memory_text || '');
        if (changed) {
          await saveUserMemory(userClient, userId, merged.memory_text, merged.preferences);
          userMemory = { memory_text: merged.memory_text, preferences: merged.preferences };
        }
      }
    }
    return { reply, actions: buildActions(messages, executedTools) };
  }

  return { reply: '依力绕晕了，换个问法试试？', actions: [] };
}

// ---------- 结构化 actions 生成 ----------
function buildActions(messages, executedTools) {
  const actions = [];
  const seen = new Set();
  const push = (a) => {
    const key = a.to || a.workId || a.ideaId || a.label;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    actions.push(a);
  };

  for (const t of executedTools) {
    if (t.name === 'search_works' && Array.isArray(t.data?.results)) {
      for (const w of t.data.results.slice(0, 4)) {
        push({ type: 'work_card', workId: w.id, title: w.title, url: w.url || '', to: `/website/${w.id}` });
      }
    }
    if (t.name === 'get_discovery_rail' && Array.isArray(t.data?.results)) {
      for (const w of t.data.results.slice(0, 4)) {
        push({ type: 'work_card', workId: w.id, title: w.title, url: w.url || '', to: `/website/${w.id}` });
      }
    }
    if (t.name === 'get_work' && t.data?.work) {
      push({ type: 'work_card', workId: t.data.work.id, title: t.data.work.title, url: t.data.work.url || '', to: `/website/${t.data.work.id}` });
    }
    if (t.name === 'get_ideas' && Array.isArray(t.data?.results)) {
      for (const i of t.data.results.slice(0, 4)) {
        push({ type: 'idea_card', ideaId: i.id, title: i.title, to: `/ideas/${i.id}` });
      }
    }
    if (t.name === 'get_creator' && t.data?.profile) {
      push({ type: 'guide_card', label: `@${t.data.profile.username} 的主页`, to: `/user/${t.data.profile.id}` });
    }
    if (t.name === 'get_platform_guide' && t.data?.guide) {
      push({ type: 'guide_card', label: t.data.guide.label, to: t.data.guide.to });
    }
  }

  // 常见意图 → 页面快捷入口（保留 v2 行为）
  const lastUser = [...messages].reverse().find((m) => m.role === 'user' || m.role === 'yili');
  const q = String(lastUser?.content || '');
  if (/联系|反馈|合作|邮箱|微信|qq|投诉|意见/.test(q)) push({ type: 'guide_card', label: '联系我们', to: '/contact' });
  if (/投稿|发布|上传|提交作品|怎么加/.test(q)) push({ type: 'guide_card', label: '去投稿', to: '/create' });
  if (/登录|注册|账号|密码|退出/.test(q)) push({ type: 'guide_card', label: '个人中心', to: '/profile' });

  return actions;
}

// ---------- 降级：规则版回复（LLM 不可用时） ----------
async function fallbackReply(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user' || m.role === 'yili');
  const q = String(lastUser?.content || '');
  // agentFallback 依赖链使用 import.meta.env（Vite 专属），在函数环境须动态 import 并容错
  let rule = null;
  try {
    const mod = await import('../../src/services/agentFallback.js');
    rule = await mod.getRuleReply(q);
  } catch {
    rule = null;
  }
  try {
    const actions = [];
    for (const w of (rule.works || []).slice(0, 4)) {
      actions.push({ type: 'work_card', workId: w.id, title: w.title, url: w.url || '', to: `/website/${w.id}` });
    }
    for (const l of (rule.links || []).slice(0, 3)) {
      actions.push({ type: 'guide_card', label: l.label, to: l.to });
    }
    return { reply: rule.text || '依力现在有点忙，稍后再试～', actions };
  } catch {
    return { reply: '依力现在有点忙，稍后再试～', actions: [] };
  }
}

// ---------- 入口 ----------
export default async (req) => {
  const isLocal = /localhost|127\.0\.0\.1|11434/.test(ENV.LLM_URL);
  if (!ENV.LLM_API_KEY && !isLocal) {
    return json({ reply: '依力的大脑还没接好（缺少 LLM_API_KEY，详见使用说明）' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ reply: '你说得太快了，我没听清～' }, 400);
  }
  const { messages = [], persona = '', userId = null, idToken = null } = body;
  if (!Array.isArray(messages)) {
    return json({ reply: '消息格式不对哦～' }, 400);
  }

  try {
    const { reply, actions } = await runAgent(messages, { persona, userId, idToken });
    return json({ reply, actions });
  } catch (err) {
    console.error('yili-chat error:', err);
    // LLM 或流程异常 → 规则版兜底
    const fb = await fallbackReply(messages);
    return json({ reply: fb.reply, actions: fb.actions }, 200);
  }
};




