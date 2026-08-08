import React from 'react';
import { Link } from 'react-router-dom';
import { IdeaStatusBadge } from './IdeaStatusBadge.jsx';
import { ideaCategoryLabel } from '../services/idea-logic.js';

const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 7 * 24 * 3600 * 1000) return `${Math.floor(diff / 86400000)} 天前`;
  return date.toLocaleDateString('zh-CN');
};

export function IdeaCard({ idea }) {
  return (
    <article className="ym-idea-card">
      <Link to={`/ideas/${idea.id}`} className="ym-idea-card-main">
        <div className="ym-idea-card-tags">
          <IdeaStatusBadge status={idea.status} size="sm" />
          {idea.pinned && <span className="ym-work-badge">置顶</span>}
          <span className="ym-work-badge">{ideaCategoryLabel(idea.category)}</span>
          {(idea.tags || []).slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
        <h3 className="ym-idea-card-title">{idea.title}</h3>
        {idea.description && <p className="ym-idea-card-description">{idea.description}</p>}
      </Link>
      <div className="ym-idea-card-meta">
        <Link to={`/user/${idea.user_id}`} className="ym-work-card-author">
          {idea.avatar_url ? <img className="ym-avatar ym-avatar-sm" src={idea.avatar_url} alt="" loading="lazy" decoding="async" /> : <span className="ym-avatar-fallback ym-avatar-sm">神</span>}
          <span>{idea.username}</span>
        </Link>
        <span>{idea.vote_count} 赞同</span>
        <span>{idea.comment_count} 评论</span>
        <span>{idea.favorite_count} 收藏</span>
        <span>{formatRelativeTime(idea.created_at)}</span>
      </div>
    </article>
  );
}
