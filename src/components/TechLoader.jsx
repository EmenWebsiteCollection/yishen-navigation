// src/components/TechLoader.jsx
// 科技风统一加载组件：双环旋转 + 中心呼吸节点 + HUD 四角角标 + 可选文字
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
      <div className="tl-ring tl-ring-a" />
      <div className="tl-ring tl-ring-b" />
      <div className="tl-dashes" />
      <div className="tl-core">神</div>
      <span className="tl-corner tl-c1" />
      <span className="tl-corner tl-c2" />
      <span className="tl-corner tl-c3" />
      <span className="tl-corner tl-c4" />
      {text && <div className="tl-text">{text}</div>}
    </div>
  );
}

export default TechLoader;
