// src/components/YiliChatPanel.jsx
// 依力 AI 对话面板（v3：风格注入 + 卡片 actions + 个性化记忆）
//
// v3 变更：
//   1. 登录用户把 idToken/userId 随消息传给代理函数 → 读写 user_memories（RLS 仅本人）
//   2. 记忆开关：关闭后不再传 idToken（即不读写记忆），状态存 localStorage
//   3. actions 渲染结构化卡片（work_card / idea_card / guide_card），复用站点视觉
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRuleReply } from '../services/agentFallback.js';
import { supabase } from '../services/supabase.js';
import { ChatActionCard } from './ChatActionCard.jsx';

export const YILI_PERSONA_PROMPT = '';

const CHAT_ENDPOINT = '/.netlify/functions/yili-chat';
const AI_TIMEOUT_MS = 10000;
const MEMORY_KEY = 'yili-memory-enabled';

const GREETING = '你好，我是依力～想看点什么？可以直接问我，比如「有什么好玩的网站」。';

function isMemoryEnabled() {
  return localStorage.getItem(MEMORY_KEY) !== 'off';
}

// 登录用户会话（用于个性化记忆；匿名/未登录返回 null）
async function getAuthContext() {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    const user = session?.user;
    if (!user || user.is_anonymous) return null;
    return { userId: user.id, idToken: session.access_token };
  } catch {
    return null;
  }
}

async function fetchReply(messages, authCtx) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const query = String(lastUser?.content || '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const body = { messages, persona: YILI_PERSONA_PROMPT };
    if (authCtx && isMemoryEnabled()) {
      body.userId = authCtx.userId;
      body.idToken = authCtx.idToken;
    }
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`chat endpoint ${res.status}`);
    const data = await res.json();
    if (!data.reply) throw new Error('empty reply');
    return data;
  } catch (err) {
    console.warn('依力 AI 不可用，降级到规则版:', err);
    const rule = await getRuleReply(query);
    return { reply: rule.text || '唔…依力现在有点状况，稍后再试试？', actions: [], offline: true };
  } finally {
    clearTimeout(timer);
  }
}

export function YiliChatPanel({ open, onClose }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(() => [{ role: 'yili', content: GREETING, actions: [] }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(isMemoryEnabled);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, open, thinking]);

  const toggleMemory = () => {
    const next = !memoryEnabled;
    setMemoryEnabled(next);
    if (next) localStorage.removeItem(MEMORY_KEY);
    else localStorage.setItem(MEMORY_KEY, 'off');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    const history = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setThinking(true);
    try {
      const authCtx = await getAuthContext();
      const data = await fetchReply(history, authCtx);
      setMessages((m) => [
        ...m,
        {
          role: 'yili',
          content: data.reply,
          actions: data.actions || [],
          offline: !!data.offline,
        },
      ]);
    } catch (err) {
      console.warn('依力回复失败:', err);
      setMessages((m) => [...m, { role: 'yili', content: '唔…依力刚才卡了一下，稍等再试？', actions: [], offline: true }]);
    } finally {
      setThinking(false);
    }
  };

  if (!open) return null;

  return (
    <section className="ym-chat-panel" aria-label="和依力聊天">
      <header className="ym-chat-header">
        <span className={'ym-chat-status' + (thinking ? ' thinking' : '')} aria-hidden="true" />
        <span className="ym-chat-title">依力</span>
        <span className="ym-chat-hint">AI 接入中</span>
        <button
          type="button"
          className="ym-chat-memory-toggle"
          onClick={toggleMemory}
          title={memoryEnabled ? '依力会记住你的偏好（点击关闭）' : '记忆已关闭（点击开启）'}
        >
          {memoryEnabled ? '🧠' : '💤'}
        </button>
        <button type="button" className="ym-chat-close" onClick={onClose} aria-label="收起对话面板">
          ✕
        </button>
      </header>

      <div className="ym-chat-body" ref={bodyRef}>
        {messages.map((m, i) => (
          <div key={i} className={'ym-chat-msg-wrap' + (m.role === 'user' ? ' user' : ' yili')}>
            <div className={'ym-chat-msg ' + (m.role === 'user' ? 'user' : 'yili')}>
              {m.content}
              {m.offline && (
                <span className="ym-chat-offline-tag" title="AI 服务不可用，当前为规则版回答">
                  离线模式
                </span>
              )}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="ym-chat-actions">
                {m.actions.map((a, j) => (
                  <ChatActionCard key={j} action={a} />
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && <div className="ym-chat-msg yili typing">依力正在想…</div>}
      </div>

      <div className="ym-chat-input-row">
        <input
          className="ym-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="问依力点什么…"
          aria-label="消息输入框"
        />
        <button
          type="button"
          className="ym-chat-send"
          onClick={send}
          disabled={thinking || !input.trim()}
        >
          发送
        </button>
      </div>
    </section>
  );
}
