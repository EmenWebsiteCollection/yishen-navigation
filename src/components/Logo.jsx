// src/components/Logo.jsx
import React from 'react';

export function Logo() {
  return (
    <div className="ym-logo">
      <img className="ym-logo-mark" src={`${import.meta.env.BASE_URL}yili.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async" />
      <span className="ym-logo-name">依神网站汇总</span>
    </div>
  );
}
