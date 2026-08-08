// src/components/IdeaCard.jsx
// 想法卡片：状态 / 分类 / 标签 / 投票·评论·关注数 / 作者
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { IdeaStatusBadge } from './IdeaStatusBadge.jsx';
import { ideaCategoryLabel } from '../services/idea-logic.js';

export function IdeaCard({ idea }) {
  const [hover, setHover] = useState(false);
  const fmt = (t) => {
    if (!t) return '';
    const d = new Date(t);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 7 * 24 * 3600 * 1000) return `${Math.floor(diff / 86400000)} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <Link
      to={`/ideas/${idea.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          padding: '18px 20px',
          backgroundColor: 'var(--ym-bg-card)',
          border: '1px solid var(--ym-border)',
          borderRadius: 'var(--ym-radius-md)',
          marginBottom: '12px',
          boxShadow: hover ? '0 6px 18px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.03)',
          transform: hover ? 'translateY(-1px)' : 'none',
          transition: 'all var(--ym-transition)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <IdeaStatusBadge status={idea.status} size="sm" />
          {idea.pinned && (
            <span style={{ fontSize: '12px', color: 'var(--ym-accent)', fontWeight: '500' }}>📌 置顶</span>
          )}
          <span
            style={{
              fontSize: '12px',
              padding: '2px 10px',
              borderRadius: '10px',
              backgroundColor: 'var(--ym-bg-subtle)',
              color: 'var(--ym-text-secondary)',
            }}
          >
            {ideaCategoryLabel(idea.category)}
          </span>
          {(idea.tags || []).slice(0, 3).map((t) => (
            <span key={t} style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>
              #{t}
            </span>
          ))}
        </div>

        <h3
          style={{
            margin: '0 0 6px',
            fontSize: '17px',
            fontWeight: '500',
            color: 'var(--ym-text-primary)',
            fontFamily: 'var(--ym-font-display)',
            letterSpacing: '0.5px',
          }}
        >
          {idea.title}
        </h3>
        {idea.description && (
          <p
            style={{
              margin: '0 0 12px',
              fontSize: '14px',
              color: 'var(--ym-text-secondary)',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {idea.description}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--ym-text-muted)' }}>
          <Link
            to={`/user/${idea.user_id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--ym-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {idea.avatar_url ? (
              <img src={idea.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--ym-bg-subtle)', textAlign: 'center', lineHeight: '20px', fontSize: '11px' }}>👤</span>
            )}
            {idea.username}
          </Link>
          <span>👍 {idea.vote_count}</span>
          <span>💬 {idea.comment_count}</span>
          <span>⭐ {idea.favorite_count}</span>
          <span>{fmt(idea.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
