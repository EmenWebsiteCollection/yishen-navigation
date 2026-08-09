// src/components/TechLoader.jsx
// 翅膀 E logo 加载组件：翅膀循环展开 + 呼吸 + 可选文字
// 用法：<TechLoader size={56} text="加载中..." />
// 样式：src/styles/tech-loader.css（main.jsx 全局引入）
import React from 'react';

export function TechLoader({ size = 56, text }) {
  return (
    <div
      className="tech-loader"
      style={{ '--tl-size': `${size}px` }}
      role="status"
      aria-live="polite"
      aria-label={text || '加载中'}
    >
      <svg className="tl-logo" viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg">
        <g className="tl-wing tl-wing-left tl-wing-top">
          <path d="M 112,44 Q 75,28 28,36 Q 70,50 112,54 Z" />
        </g>
        <g className="tl-wing tl-wing-left tl-wing-mid">
          <path d="M 112,72 Q 72,60 22,66 Q 68,78 112,80 Z" />
        </g>
        <g className="tl-wing tl-wing-left tl-wing-bot">
          <path d="M 112,100 Q 78,92 34,102 Q 74,108 112,106 Z" />
        </g>
        <g className="tl-wing tl-wing-right tl-wing-top">
          <path d="M 128,44 Q 165,28 212,36 Q 170,50 128,54 Z" />
        </g>
        <g className="tl-wing tl-wing-right tl-wing-mid">
          <path d="M 128,72 Q 168,60 218,66 Q 172,78 128,80 Z" />
        </g>
        <g className="tl-wing tl-wing-right tl-wing-bot">
          <path d="M 128,100 Q 162,92 206,102 Q 166,108 128,106 Z" />
        </g>
        <g className="tl-letter">
          <path className="tl-e-body" d="M 118,28 h 24 v 7 h -16 v 20 h 13 v 7 h -13 v 24 h 16 v 7 h -24 Z" />
          <path className="tl-e-side" d="M 142,28 l 5,5 v 7 l -5,-5 Z" />
          <path className="tl-e-side" d="M 142,55 l 5,5 v 7 l -5,-5 Z" />
          <path className="tl-e-side" d="M 142,86 l 5,5 v 7 l -5,-5 Z" />
        </g>
      </svg>
      {text && <div className="tl-text">{text}</div>}
    </div>
  );
}

export default TechLoader;
