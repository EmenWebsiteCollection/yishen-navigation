import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTopRatedWorks } from '../services/works.js';

const MIN_SITES = 3;

function RankSkeleton() {
  return (
    <div className="ym-section-block" style={{ animation: 'ym-skeleton-pulse 1.2s ease-in-out infinite' }}>
      <div style={{ height: '14px', width: '30%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px', marginBottom: '14px' }} />
      <div style={{ display: 'flex', gap: '12px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: '0 0 180px', height: '150px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '8px' }} />
        ))}
      </div>
    </div>
  );
}

export function TopRankStrip() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTopRatedWorks(8);
        if (!cancelled) setSites(data);
      } catch (err) {
        console.warn('加载高分网站失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <RankSkeleton />;
  if (sites.length < MIN_SITES) return null;

  return (
    <section aria-label="高分网站榜单">
      <h2 className="ym-section-title">
        高分榜单
        <span className="ym-section-extra">按点赞数排序 · 每站可进入详情</span>
      </h2>
      <div className="ym-rank-strip">
        {sites.map((site, index) => (
          <Link
            key={site.id}
            to={`/website/${site.id}`}
            className="ym-card ym-card-link ym-rank-item"
          >
            <div className="ym-card-media">
              <span className="ym-rank-num">{index + 1}</span>
              {site.image_url ? (
                <img src={site.image_url} alt={site.title} loading="lazy" decoding="async"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="ym-card-media-fallback">{(site.title || '网').trim()[0]}</div>
              )}
            </div>
            <div className="ym-card-body">
              <div className="ym-card-title">{site.title}</div>
              <div className="ym-card-meta">
                <span className="ym-card-author">
                  {site.avatar_url ? (
                    <img className="ym-avatar ym-avatar-sm" src={site.avatar_url} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="ym-avatar-fallback ym-avatar-sm" style={{ fontSize: '11px' }}>👤</span>
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.username}</span>
                </span>
                <span>❤️ {site.like_count || 0}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
