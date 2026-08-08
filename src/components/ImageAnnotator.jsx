// src/components/ImageAnnotator.jsx
// Issue #39 P2：图片局部批注 —— 圈选区域（拖拽）或点选（落点）
import React, { useRef, useState } from 'react';

export function ImageAnnotator({ src, alt, addMode = false, onAdd, anchors = [] }) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null); // {x0,y0,x1,y1} 归一化

  const toNorm = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleDown = (e) => {
    if (!addMode) return;
    const p = toNorm(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const handleMove = (e) => {
    if (!addMode || !drag) return;
    const p = toNorm(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  const handleUp = (e) => {
    if (!addMode || !drag) return;
    const p = toNorm(e);
    const rect = {
      x: Math.min(drag.x0, p.x),
      y: Math.min(drag.y0, p.y),
      w: Math.abs(p.x - drag.x0),
      h: Math.abs(p.y - drag.y0),
    };
    setDrag(null);
    if (rect.w < 0.02 && rect.h < 0.02) {
      // 视为点选：落点小区域
      onAdd?.(Math.min(1, Math.max(0, rect.x - 0.03)), Math.min(1, Math.max(0, rect.y - 0.03)), 0.06, 0.06);
    } else {
      onAdd?.(rect.x, rect.y, Math.max(rect.w, 0.02), Math.max(rect.h, 0.02));
    }
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', cursor: addMode ? 'crosshair' : 'default', userSelect: 'none' }}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={() => setDrag(null)}
    >
      <img src={src} alt={alt || ''} style={{ width: '100%', display: 'block' }} />
      {/* 已有批注区域 */}
      {(anchors || []).map((a) => (
        <div
          key={a.id}
          title={a.content || '图片批注'}
          style={{
            position: 'absolute',
            left: `${a.x * 100}%`,
            top: `${a.y * 100}%`,
            width: `${a.w * 100}%`,
            height: `${a.h * 100}%`,
            border: '2px solid var(--ym-danger)',
            borderRadius: '4px',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      ))}
      {/* 拖拽中的选区 */}
      {addMode && drag && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(drag.x0, drag.x1) * 100}%`,
            top: `${Math.min(drag.y0, drag.y1) * 100}%`,
            width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
            height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
            border: '2px dashed var(--ym-accent)',
            borderRadius: '4px',
            backgroundColor: 'rgba(156,107,46,0.15)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      )}
      {addMode && (
        <div style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '12px', color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: '4px', padding: '3px 10px', pointerEvents: 'none' }}>
          圈选图片区域（或直接点击落点）
        </div>
      )}
    </div>
  );
}
