// src/components/YiliMascot.jsx
// 依力看板郎（yili.jpg）：角落固定、可拖拽、点击冒泡对话、眨眼呼吸动画、可收起。
// 纯前端实现，无 Live2D 模型文件依赖。
import React, { useEffect, useRef, useState } from 'react';

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
  const [open, setOpen] = useState(true); // 看板郎本体是否显示
  const [bubble, setBubble] = useState(null); // 对话气泡内容
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
    setPos({ x: e.clientX - rect.width / 2, y: e.clientY - rect.height / 2 });
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.moved) {
      setDragging(false);
      return; // 拖动过，不触发点击
    }
    // 单击：显示一句新的话
    setBubble(getRandomLine());
    clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 5000);
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
            role="button"
            tabIndex={0}
            aria-label="依力看板郎，拖动可移动，点击对话"
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
            <img src="/yili.jpg" alt="依力看板郎" draggable={false} />
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
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
