// src/components/YiliMascot.jsx
// 依力看板郎（yili.jpg）：角落固定、可拖拽、点击开启 AI 对话、眨眼呼吸动画、可收起。
// 纯前端实现，无 Live2D 模型文件依赖。
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { YiliChatPanel } from './YiliChatPanel.jsx';
import { setMascotPos } from '../services/mascotPos.js';

const LINES = [
  '你好，我是依力 🤙',
  '今天想逛逛什么网站？',
  '点我试试，我有话要说',
  '收藏夹里存了不少好东西',
  '发现页有宝藏，去看看吧',
  '别只收藏不点赞哦 😏',
];

const getRandomLine = () => LINES[Math.floor(Math.random() * LINES.length)];

export function YiliMascot() {
  const [open, setOpen] = useState(false); // 看板郎本体是否显示（默认收起，点击小气泡打开）
  const [bubble, setBubble] = useState(null); // 对话气泡内容
  const [chatOpen, setChatOpen] = useState(false); // AI 对话面板是否展开
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('ym-mascot-pos') || 'null');
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch (_) { /* 忽略异常 */ }
    return null; // 默认右下角，交给 CSS
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null); // 拖拽起始坐标
  const bubbleTimerRef = useRef(null);
  const dragFrameRef = useRef(null);
  const pendingDragPosRef = useRef(null);
  const mascotRef = useRef(null); // 看板郎本体，用于上报位置

  // 上报当前位置给 AgentBot，让对话框跟随看板郎
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

  // 每次出现随机说一句话（首次进入、重新打开时）
  useEffect(() => {
    if (open) {
      setBubble(getRandomLine());
      bubbleTimerRef.current = setTimeout(() => setBubble(null), 5000);
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

  const onPointerDown = (e) => {
    // 仅主键拖动；避免与点击冒泡冲突——按下不立刻拖动，移动超过阈值才视为拖动
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
      return; // 拖动过，不触发点击
    }

    // 单击：收起冒泡，交给 AI 助手开启对话
    setBubble(null);
    clearTimeout(bubbleTimerRef.current);
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
      {/* 收起态小气泡：看板郎被隐藏时提供重新打开的入口 */}
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
          {/* 对话气泡 */}
          {bubble && (
            <div className="ym-mascot-bubble">
              <span>{bubble}</span>
              <span className="ym-mascot-bubble-arrow" />
            </div>
          )}

          {/* 看板郎本体 */}
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
            <img src={`${import.meta.env.BASE_URL}yili.jpg`} alt="依力看板郎" draggable={false} />
          </div>

          {/* 关闭按钮 */}
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

      {/* AI 对话面板（Issue #56 一期） */}
      <YiliChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
