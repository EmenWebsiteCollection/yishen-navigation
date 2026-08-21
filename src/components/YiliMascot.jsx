// src/components/YiliMascot.jsx
// 看板郎入口：根据用户偏好切换浮动球 / Live2D（PNG 帧动画）形象。
// 偏好存储在 localStorage key 'ym-mascot-style'，默认 'floating-ball'。
import React, { useState, useEffect } from 'react';

import { FloatingBallMascot } from './FloatingBallMascot.jsx';
import { Live2dMascot } from './Live2dMascot.jsx';

const STORAGE_KEY = 'ym-mascot-style';

function getMascotStyle() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'live2d' || v === 'floating-ball') return v;
  } catch (_) { /* 忽略 */ }
  return 'floating-ball';
}

export function YiliMascot() {
  const [style, setStyle] = useState(getMascotStyle);

  // 跨组件通信：设置页切换时通过 CustomEvent 通知
  useEffect(() => {
    const on_change = (e) => {
      const v = e.detail;
      if (v === 'live2d' || v === 'floating-ball') setStyle(v);
    };
    window.addEventListener('ym-mascot-style-change', on_change);
    return () => window.removeEventListener('ym-mascot-style-change', on_change);
  }, []);

  return style === 'live2d' ? <Live2dMascot /> : <FloatingBallMascot />;
}

/** 供外部（ProfilePage）调用的切换函数 */
export function setMascotStyle(style) {
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch (_) { /* 忽略 */ }
  window.dispatchEvent(new CustomEvent('ym-mascot-style-change', { detail: style }));
}
