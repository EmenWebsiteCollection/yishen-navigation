// src/components/Logo.jsx
import React from 'react';

export function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{
        width: '34px',
        height: '34px',
        borderRadius: '8px',
        backgroundColor: 'var(--ym-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--ym-font-display)',
          fontSize: '18px',
          color: 'var(--ym-accent-text-on)',
          fontWeight: '500',
          lineHeight: 1,
        }}>神</span>
      </div>
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
