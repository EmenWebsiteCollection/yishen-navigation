// src/components/YiliChatPanel.jsx
// 依力 AI 对话面板（Issue #56 一期）
//
// ⚠️ 一期约定：
//   1. AI 代理函数 /.netlify/functions/yili-chat 暂未实现，请求失败时
//      自动降级为本地占位回复；代理函数就绪后无需改动前端即可切换。
//   2. 依力口语人设（YILI_PERSONA_PROMPT）暂留空，由团队在代理函数
//      system prompt 中填写。
//   3. API key 一律放服务端（Netlify 环境变量），前端不接触。
import React, { useEffect, useRef, useState } from 'react';

// 依力口语人设（占位，团队在代理函数里使用）
export const YILI_PERSONA_PROMPT = '';

// AI 代理函数地址（一期留空占位，函数上线后即生效）
const CHAT_ENDPOINT = '/.netlify/functions/yili-chat';

// 本地降级回复（代理函数不可用时，保证 UI 可演示）
const FALLBACK_REPLIES = [
  '唔…我的 AI 大脑还没装好，这句话我接不上 😅 等接入后就能陪你好好聊了。',
  '现在我只能说几句固定台词，不过很快就能学会聊天啦！',
  '这个话题我先记下了，等 AI 上线第一时间回答你～',
];
const getFallback = () => FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];

const GREETING = '你好，我是依力～想看点什么？可以直接问我，比如「有什么好玩的网站」。';

async function fetchReply(messages) {
  // 一期：代理函数可能不存在 → 抛错走降级
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, persona: YILI_PERSONA_PROMPT }),
  });
  if (!res.ok) throw new Error(`chat endpoint ${res.status}`);
  const data = await res.json();
  return data.reply;
}

export function YiliChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState(() => [{ role: 'yili', content: GREETING }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bodyRef = useRef(null);

  // 新消息/状态变化时滚到底部
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, open, thinking]);

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    const history = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setThinking(true);
    try {
      const reply = await fetchReply(history);
      setMessages((m) => [...m, { role: 'yili', content: reply }]);
    } catch (err) {
      console.warn('依力 AI 未就绪，使用本地降级回复:', err);
      setMessages((m) => [...m, { role: 'yili', content: getFallback() }]);
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
        <button type="button" className="ym-chat-close" onClick={onClose} aria-label="收起对话面板">
          ✕
        </button>
      </header>

      <div className="ym-chat-body" ref={bodyRef}>
        {messages.map((m, i) => (
          <div key={i} className={'ym-chat-msg ' + (m.role === 'user' ? 'user' : 'yili')}>
            {m.content}
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
