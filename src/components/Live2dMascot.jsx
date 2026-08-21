// src/components/Live2dMascot.jsx
// 依力看板郎（PNG 帧动画版）：角落固定、可拖拽、点击开启 AI 对话、帧切换动画、可收起。
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { YiliChatPanel } from './YiliChatPanel.jsx';
import { setMascotPos } from '../services/mascotPos.js';
import { useAuth } from '../hooks/useAuth.js';

const BASE = import.meta.env.BASE_URL;

// idle 轮播帧（i → vi），hover / click 为交互变体
const IDLE_FRAMES = [
  `${BASE}i.png`,
  `${BASE}ii.png`,
  `${BASE}iii.png`,
  `${BASE}iv.png`,
  `${BASE}v.png`,
  `${BASE}vi.png`,
];
const HOVER_FRAME = `${BASE}挥手.png`;
const CLICK_FRAME = `${BASE}惊讶后退.png`;
const THINK_FRAME = `${BASE}抱臂思考.png`;

// 预加载所有帧，避免切换时闪烁
const preload = (src) => { const img = new Image(); img.src = src; };
IDLE_FRAMES.forEach(preload);
preload(HOVER_FRAME);
preload(CLICK_FRAME);
preload(THINK_FRAME);

const LINES = [
  '你好，我是依力 🤙',
  '今天想逛逛什么网站？',
  '点我试试，我有话要说',
  '收藏夹里存了不少好东西',
  '发现页有宝藏，去看看吧',
  '别只收藏不点赞哦 😏',
];

const getRandomLine = () => LINES[Math.floor(Math.random() * LINES.length)];

export function Live2dMascot() {
  const { user, isAnonymous } = useAuth();
  const isLoggedIn = Boolean(user && !isAnonymous);
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [frame, setFrame] = useState(0); // idle 轮播索引
  const [mode, setMode] = useState('idle'); // idle | hover | click | think | chat
  const modeRef = useRef('idle');
  const setModeTracked = (v) => { modeRef.current = v; setMode(v); };
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
  const frameIdxRef = useRef(0);
  const isHoveringRef = useRef(false);

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
    const f = window.requestAnimationFrame(reportMascotPosition);
    return () => window.cancelAnimationFrame(f);
  }, [open, pos, reportMascotPosition]);

  useEffect(() => () => {
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
  }, []);

  // 打开时显示随机气泡
  useEffect(() => {
    if (open) {
      setBubble(getRandomLine());
      bubbleTimerRef.current = setTimeout(() => setBubble(null), 3000);
    }
    return () => clearTimeout(bubbleTimerRef.current);
  }, [open]);

  // 持久化拖拽位置
  useEffect(() => {
    if (pos) {
      try {
        sessionStorage.setItem('ym-mascot-pos', JSON.stringify(pos));
      } catch (_) { /* 忽略异常 */ }
    }
  }, [pos]);

  // idle 轮播：每 230ms 推进一帧，到达最后一帧停 4 秒说话后从头再播
  useEffect(() => {
    if (!open) return;
    frameIdxRef.current = 0;
    setFrame(0);
    let phase = 'running'; // running | pausing | speaking
    let pauseTimer = null;
    let bubbleTimer = null;

    const interval = setInterval(() => {
      if (modeRef.current !== 'idle' || phase !== 'running') return;
      const next = (frameIdxRef.current + 1) % IDLE_FRAMES.length;
      frameIdxRef.current = next;
      setFrame(next);
      if (next === IDLE_FRAMES.length - 1) {
        // 到达最后一帧：暂停并说话
        phase = 'pausing';
        clearTimeout(pauseTimer);
        pauseTimer = setTimeout(() => {
          setBubble(getRandomLine());
          phase = 'speaking';
          bubbleTimer = setTimeout(() => {
            setBubble(null);
            phase = 'running';
          }, 3000);
        }, 4000);
      }
    }, 230);

    return () => {
      clearInterval(interval);
      clearTimeout(pauseTimer);
      clearTimeout(bubbleTimer);
    };
  }, [open]);

  // hover: 暂停轮播，显示 hover 帧
  const onPointerEnter = () => {
    isHoveringRef.current = true;
    if (modeRef.current === 'idle') setModeTracked('hover');
  };

  const onPointerLeave = () => {
    isHoveringRef.current = false;
    if (modeRef.current === 'hover') setModeTracked('idle');
  };

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
    setModeTracked('click'); // 拖动时显示惊讶后退
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
      // 拖动结束：显示惊讶帧 1 秒后恢复 idle
      setTimeout(() => setModeTracked('idle'), 1000);
      return;
    }

    // 点击：显示抱臂思考帧，然后开启对话
    setModeTracked('think');
    setBubble(null);
    clearTimeout(bubbleTimerRef.current);
    if (!isLoggedIn) {
      setBubble('AI 对话需要登录后使用，先去登录吧');
      window.dispatchEvent(new CustomEvent('ym-open-login'));
      setTimeout(() => setModeTracked('idle'), 2000);
      return;
    }
    // 思考 1.5 秒后打开对话面板
    setTimeout(() => {
      setModeTracked('chat');
      setChatOpen(true);
    }, 1500);
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
            className={`ym-mascot-body ym-live2d-body ${mode === 'click' ? 'ym-live2d-click' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { dragRef.current = null; setDragging(false); }}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPointerUp({});
              }
            }}
          >
            <img
              src={
                mode === 'click' ? CLICK_FRAME
                  : mode === 'hover' ? HOVER_FRAME
                  : mode === 'think' || mode === 'chat' ? THINK_FRAME
                  : IDLE_FRAMES[frame]
              }
              alt="依力看板郎"
              draggable={false}
            />
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
              setFrame(0);
              setModeTracked('idle');
            }}
          >
            ✕
          </button>
        </div>
      )}

      <YiliChatPanel open={chatOpen} onClose={() => { setChatOpen(false); setModeTracked('idle'); }} />
    </>
  );
}
