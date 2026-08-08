import React from 'react';

export function PageHero({ emoji, title, subtitle, className, style }) {
  return (
    <header className={`ym-page-hero${className ? ' ' + className : ''}`} style={style}>
      <div className="ym-page-hero-title-row">
        {emoji && <span className="ym-page-hero-icon" aria-hidden="true">{emoji}</span>}
        <h1>{title}</h1>
      </div>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
