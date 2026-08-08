// src/services/agentFallback.js
// 依力离线兜底：AI 代理函数不可用时，降级为规则版回答。
// 逻辑从 AgentBot.jsx 提取，供 YiliChatPanel 统一入口复用。
import { classifyAgentIntent, extractWorkType, formatAgentReply, normalizeAgentQuery } from './agent.js';
import { searchWebsites } from './search.js';
import { getTopRatedWorks, getWorks } from './works.js';

/**
 * 规则版回答（原 AgentBot.answer 的核心逻辑）
 * @param {string} raw 用户输入
 * @returns {Promise<{text: string, works: Array, links: Array}>}
 */
export async function getRuleReply(raw) {
  const query = normalizeAgentQuery(raw);
  if (!query) return { text: '', works: [], links: [] };

  const intent = classifyAgentIntent(query);
  const type = extractWorkType(query);
  let works = [];

  if (intent === 'recommend') {
    works =
      type && type !== 'website'
        ? (await getWorks({ type, pageSize: 5 })).works || []
        : await getTopRatedWorks(5);
  } else if (intent === 'search') {
    if (type) {
      works = (await getWorks({ type, pageSize: 5 })).works || [];
    } else {
      works = (await searchWebsites(query, { limit: 5 })).results || [];
    }
  }

  return formatAgentReply(intent, query, works);
}
