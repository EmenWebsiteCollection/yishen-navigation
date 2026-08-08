// src/components/WorkCard.jsx
// Issue #39 P1：发现列表通用作品卡片（标签/AI 徽章/统计）
import React from 'react';
import { Link } from 'react-router-dom';
import { workTypeLabel, aiDegreeLabel } from '../services/works.js';

const AI_BADGE_COLORS = {
  none: 'var(--ym-success)',
  assisted: 'var(--ym-accent)',
  mixed: 'var(--ym-accent)',
  generated: 'var(--ym-danger)',
  unknown: 'var(--ym-text-muted)',
};

export function WorkCard({ work }) {
  const cover = work.cover_url || work.image_url;
  return (
    <Link
      to={`/website/${work.id}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        border: '1px solid var(--ym-border)',
        borderRadius: 'var(--ym-radius-md)',
        backgroundColor: 'var(--ym-bg-card)',
        overflow: 'hidden',
        transition: 'box-shadow var(--ym-transition), transform var(--ym-transition)',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {cover ? (
        <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--ym-bg-subtle)', overflow: 'hidden' }}>
          <img
            src={cover}
            alt={work.title}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      ) : (
        <div
          style={{
            aspectRatio: '16/9',
            backgroundColor: 'var(--ym-bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            color: 'var(--ym-text-muted)',
          }}
        >
          {work.work_type === 'website' ? '🌐' : work.work_type === 'novel' ? '📖' : work.work_type === 'illustration' ? '🎨' : work.work_type === 'game' ? '🎮' : work.work_type === 'music' ? '🎵' : work.work_type === 'video' ? '🎬' : work.work_type === 'photo' ? '📷' : '✨'}
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)', lineHeight: 1.35 }}>
            {work.title}
          </span>
          {work.featured && (
            <span style={{ fontSize: '11px', color: '#fff', backgroundColor: 'var(--ym-accent)', borderRadius: '10px', padding: '1px 8px', flexShrink: 0 }}>
              精选
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ym-text-muted)', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {work.avatar_url ? (
              <img src={work.avatar_url} alt="" loading="lazy" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span>👤</span>
            )}
            {work.username}
          </span>
          <span>· {workTypeLabel(work.work_type)}</span>
          {work.completion != null && <span>· {work.completion}%</span>}
        </div>

        {(work.tags || []).length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {(work.tags || []).slice(0, 3).map((t) => (
              <span key={t} style={{ fontSize: '11px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '10px', padding: '1px 8px' }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
          <span>❤️ {work.like_count ?? 0} · 💬 {work.comment_count ?? 0} · 🔖 {work.favorite_count ?? 0}</span>
          <span
            style={{
              fontSize: '11px',
              color: AI_BADGE_COLORS[work.ai_degree] || 'var(--ym-text-muted)',
              border: `1px solid ${AI_BADGE_COLORS[work.ai_degree] || 'var(--ym-border)'}`,
              borderRadius: '10px',
              padding: '1px 8px',
              flexShrink: 0,
            }}
            title="AI 参与程度（合规标识）"
          >
            {aiDegreeLabel(work.ai_degree)}
          </span>
        </div>
      </div>
    </Link>
  );
}
