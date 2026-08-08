// src/components/Logo.jsx
import React from 'react';

export function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img
        src="/yili.jpg"
        alt="依神网站汇总"
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
      <span style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '17px',
        fontWeight: '500',
        color: 'var(--ym-text-primary)',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
      }}>依神网站汇总</span>
    </div>
  );
}
