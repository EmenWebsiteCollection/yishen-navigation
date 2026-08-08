import React from 'react';
import { Link } from 'react-router-dom';
import { workTypeLabel, aiDegreeLabel } from '../services/works.js';

export function WorkCard({ work }) {
  const cover = work.cover_url || work.image_url;
  return (
    <Link to={`/website/${work.id}`} className="ym-work-card">
      <div className="ym-work-card-media">
        <div className="ym-work-card-fallback">{workTypeLabel(work.work_type) || '作品'}</div>
        {cover && (
          <img
            src={cover}
            alt={work.title}
            loading="lazy"
            decoding="async"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        )}
      </div>

      <div className="ym-work-card-body">
        <div className="ym-work-card-heading">
          <h3 className="ym-work-card-title">{work.title}</h3>
          {work.featured && <span className="ym-work-badge">编辑精选</span>}
        </div>

        <div className="ym-work-card-submeta">
          <span className="ym-work-card-author">
            {work.avatar_url ? <img className="ym-avatar ym-avatar-sm" src={work.avatar_url} alt="" loading="lazy" /> : <span className="ym-avatar-fallback ym-avatar-sm">神</span>}
            <span>{work.username}</span>
          </span>
          <span>{workTypeLabel(work.work_type)}</span>
          {work.completion != null && <span>完成度 {work.completion}%</span>}
        </div>

        {(work.tags || []).length > 0 && (
          <div className="ym-work-card-tags">
            {(work.tags || []).slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
        )}

        <div className="ym-work-card-stats">
          <span>{work.like_count ?? 0} 赞 · {work.comment_count ?? 0} 评论 · {work.favorite_count ?? 0} 收藏</span>
          <span className="ym-work-badge" title="AI 参与程度（合规标识）">{aiDegreeLabel(work.ai_degree)}</span>
        </div>
      </div>
    </Link>
  );
}
