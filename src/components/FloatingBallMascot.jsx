// src/components/FloatingBallMascot.jsx
// 浮动球看板郎（yili.webp）：角落固定、可拖拽、点击开启 AI 对话、眨眼呼吸动画、可收起。
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { YiliChatPanel } from './YiliChatPanel.jsx';
import { setMascotPos } from '../services/mascotPos.js';
import { useAuth } from '../hooks/useAuth.js';

const LINES = [
  '你好，我是依力 🤙',
  '今天想逛逛什么网站？',
  '点我试试，我有话要说',
  '收藏夹里存了不少好东西',
  '发现页有宝藏，去看看吧',
  '别只收藏不点赞哦 😏',
];

const getRandomLine = () => LINES[Math.floor(Math.random() * LINES.length)];

export function FloatingBallMascot() {
  const { user, isAnonymous } = useAuth();
  const isLoggedIn = Boolean(user && !isAnonymous);
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('ym-mascot-pos') || 'null');
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch (_) { /* 忽略异常 */ }
    return null;
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const bubbleTimerRef = useRef(null);
  const dragFrameRef = useRef(null);
  const pendingDragPosRef = useRef(null);
  const mascotRef = useRef(null);

  const reportMascotPosition = useCallback(() => {
    const el = mascotRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setMascotPos({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    }
  }, []);

  useEffect(() => {
    reportMascotPosition();
    window.addEventListener('resize', reportMascotPosition);
    return () => window.removeEventListener('resize', reportMascotPosition);
  }, [open, reportMascotPosition]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(reportMascotPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, pos, reportMascotPosition]);

  useEffect(() => () => {
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
  }, []);

  useEffect(() => {
    if (open) {
      setBubble(getRandomLine());
      bubbleTimerRef.current = setTimeout(() => setBubble(null), 5000);
    }
    return () => clearTimeout(bubbleTimerRef.current);
  }, [open]);

  useEffect(() => {
    if (pos) {
      try {
        sessionStorage.setItem('ym-mascot-pos', JSON.stringify(pos));
      } catch (_) { /* 忽略异常 */ }
    }
  }, [pos]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    pendingDragPosRef.current = { x: e.clientX - rect.width / 2, y: e.clientY - rect.height / 2 };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      if (pendingDragPosRef.current) setPos(pendingDragPosRef.current);
    });
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.moved) {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      if (pendingDragPosRef.current) setPos(pendingDragPosRef.current);
      pendingDragPosRef.current = null;
      setDragging(false);
      return;
    }

    setBubble(null);
    clearTimeout(bubbleTimerRef.current);
    if (!isLoggedIn) {
      setBubble('AI 对话需要登录后使用，先去登录吧');
      window.dispatchEvent(new CustomEvent('ym-open-login'));
      return;
    }
    setChatOpen(true);
  };

  const mascotStyle = {
    position: 'fixed',
    zIndex: 900,
    width: 'fit-content',
    height: 'fit-content',
    cursor: dragging ? 'grabbing' : 'grab',
    touchAction: 'none',
    userSelect: 'none',
    ...(pos
      ? { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto', bottom: 'auto' }
      : { right: '20px', bottom: '132px' }),
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="打开看板郎"
          title="打开看板郎"
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            right: '20px',
            bottom: '132px',
            zIndex: 900,
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--ym-bg-card)',
            border: '1px solid var(--ym-border)',
            color: 'var(--ym-accent)',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            fontSize: '20px',
          }}
        >
          🎭
        </button>
      )}

      {open && (
        <div style={mascotStyle}>
          {bubble && (
            <div className="ym-mascot-bubble">
              <span>{bubble}</span>
              <span className="ym-mascot-bubble-arrow" />
            </div>
          )}

          <div
            ref={mascotRef}
            role="button"
            tabIndex={0}
            aria-label="依力看板郎，拖动可移动，点击开启 AI 对话"
            className="ym-mascot-body"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { dragRef.current = null; setDragging(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPointerUp({});
              }
            }}
          >
            <img src={`${import.meta.env.BASE_URL}yili.webp`} alt="依力看板郎" draggable={false} loading="lazy" decoding="async" />
          </div>

          <button
            type="button"
            aria-label="收起看板郎"
            title="收起看板郎"
            className="ym-mascot-close"
            onClick={() => {
              setOpen(false);
              setBubble(null);
              setChatOpen(false);
            }}
          >
            ✕
          </button>
        </div>
      )}

      <YiliChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
