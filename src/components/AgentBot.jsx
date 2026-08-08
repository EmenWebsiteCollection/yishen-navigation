// src/components/AgentBot.jsx
// 全站悬浮「依力」：免费规则问答，数据来自站内作品与静态 FAQ。
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchWebsites } from '../services/search.js';
import { getTopRatedWorks, getWorks, workTypeLabel } from '../services/works.js';
import yiliAvatar from '../assets/yili-avatar.png';
import {
  classifyAgentIntent,
  extractWorkType,
  formatAgentReply,
  normalizeAgentQuery,
} from '../services/agent.js';
import '../styles/agent.css';

const QUICK_QUESTIONS = ['推荐网站', '找小说', '怎么投稿', '联系我们'];

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

export function AgentBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      role: 'bot',
      text: '你好呀，我是依力～想看点什么都可以直接问我，找作品、要推荐、问投稿都行！',
    },
  ]);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const seqRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const answer = async (raw) => {
    const query = normalizeAgentQuery(raw);
    if (!query || busyRef.current) return;
    const seq = ++seqRef.current;
    busyRef.current = true;
    setBusy(true);
    setInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: query },
      { role: 'bot', text: '依力正在找…' },
    ]);

    try {
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

      const reply = formatAgentReply(intent, query, works);
      if (seq !== seqRef.current) return;
      setMessages((prev) => [...prev.slice(0, -1), { role: 'bot', ...reply }]);
    } catch (err) {
      console.error('依力回答失败:', err);
      if (seq !== seqRef.current) return;
      setMessages((prev) => [...prev.slice(0, -1), { role: 'bot', text: '唔，依力刚才卡了一下，稍等再试，或者换个说法？' }]);
    } finally {
      if (seq === seqRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    answer(input);
  };

  return (
    <div ref={rootRef} className="ym-agent">
      {open && (
        <div className="ym-agent-panel" role="dialog" aria-label="依力">
          <div className="ym-agent-header">
            <span className="ym-agent-title">依力</span>
            <button
              type="button"
              className="ym-agent-close"
              onClick={() => setOpen(false)}
              aria-label="关闭依力"
              title="关闭"
            >
              <CloseIcon />
            </button>
          </div>

          {messages.length <= 1 && (
            <div className="ym-agent-chips" aria-label="快捷问题">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="ym-agent-chip"
                  onClick={() => answer(q)}
                  disabled={busy}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="ym-agent-messages" ref={listRef}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={'ym-agent-msg' + (msg.role === 'user' ? ' ym-agent-msg-user' : ' ym-agent-msg-bot')}
              >
                {msg.role === 'bot' && (
                  <img className="ym-agent-avatar" src={yiliAvatar} alt="" aria-hidden="true" />
                )}
                <div className="ym-agent-bubble">
                  <div>{msg.text}</div>
                  {msg.works && msg.works.length > 0 && (
                    <div className="ym-agent-results">
                      {msg.works.map((work) => (
                        <Link
                          key={work.id}
                          to={`/website/${work.id}`}
                          className="ym-agent-result"
                          onClick={() => setOpen(false)}
                        >
                          <div className="ym-agent-result-title">{work.title}</div>
                          <div className="ym-agent-result-meta">
                            {workTypeLabel(work.work_type)} · {work.like_count || 0} 赞
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {msg.links && msg.links.length > 0 && (
                    <div className="ym-agent-links">
                      {msg.links.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          className="ym-agent-link"
                          onClick={() => setOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form className="ym-agent-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你想问的问题"
              aria-label="输入问题"
              autoComplete="off"
              maxLength={80}
              disabled={busy}
            />
            <button
              type="submit"
              className="ym-agent-send"
              disabled={busy || !input.trim()}
              aria-label="发送"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="ym-agent-launcher"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? '关闭依力' : '打开依力'}
        title="依力"
      >
        {open ? (
          <CloseIcon />
        ) : (
          <img className="ym-agent-launcher-avatar" src={yiliAvatar} alt="" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
