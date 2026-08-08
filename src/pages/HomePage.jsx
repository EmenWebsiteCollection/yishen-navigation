// 首页：高分榜单 + B 站式网站卡片信息流。
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWorks, likeWork, unlikeWork } from '../services/works.js';
import { supabase } from '../services/supabase.js';
import { TopRankStrip } from '../components/TopRankStrip.jsx';

const PAGE_SIZE = 10;

const SkeletonCard = () => (
  <div className="ym-card" style={{ animation: 'ym-skeleton-pulse 1.2s ease-in-out infinite' }}>
    <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--ym-bg-subtle)' }} />
    <div style={{ padding: '14px 16px' }}>
      <div style={{ height: '16px', width: '70%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ height: '13px', width: '50%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px' }} />
    </div>
  </div>
);

function WorkCard({ site, index, page, user, liking, onToggleLike, onOpen }) {
  return (
    <div
      className="ym-card"
      onClick={onOpen}
      style={{ cursor: 'pointer' }}
    >
      <div className="ym-card-media">
        <span className="ym-card-badge">
          {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}
        </span>
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
          <Link
            to={`/user/${site.user_id}`}
            onClick={(e) => e.stopPropagation()}
            className="ym-card-author"
            style={{ textDecoration: 'none' }}
          >
            {site.avatar_url ? (
              <img className="ym-avatar ym-avatar-sm" src={site.avatar_url} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="ym-avatar-fallback ym-avatar-sm" style={{ fontSize: '11px' }}>👤</span>
            )}
            <span>{site.username}</span>
          </Link>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <span>❤️ {site.like_count || 0}</span>
            {user && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(site.id, site.liked_by_user || false);
                }}
                disabled={liking}
                style={{
                  border: 'none',
                  background: 'none',
                  color: site.liked_by_user ? 'var(--ym-accent)' : 'var(--ym-text-muted)',
                  cursor: liking ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: site.liked_by_user ? '600' : '400',
                }}
              >
                {site.liked_by_user ? '已赞' : '点赞'}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const likedRefs = useRef({});
  const likingRefs = useRef({});

  const loadWebsites = async (page) => {
    try {
      setLoading(true);
      setError(null);
      const { works: data, total } = await getWorks({ page, pageSize: PAGE_SIZE });
      setTotalItems(total);
      setTotalPages(Math.ceil(total / PAGE_SIZE) || 1);

      if (user) {
        try {
          const { data: likes, error: likeError } = await supabase
            .from('website_likes')
            .select('website_id')
            .eq('user_id', user.id);
          if (!likeError && likes) {
            const likedIds = new Set(likes.map((l) => l.website_id));
            data.forEach((site) => {
              site.liked_by_user = likedIds.has(site.id);
              likedRefs.current[site.id] = likedIds.has(site.id);
              likingRefs.current[site.id] = false;
            });
          }
        } catch (likeErr) {
          console.warn('获取点赞状态失败:', likeErr);
        }
      } else {
        data.forEach((site) => {
          likedRefs.current[site.id] = false;
          likingRefs.current[site.id] = false;
        });
      }
      setWebsites(data);
    } catch (err) {
      setError('加载网站列表失败，请稍后重试。');
      console.error('加载网站列表错误:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    if (page > 0) loadWebsites(page);
  }, [searchParams, user]);

  const handleLikeToggle = async (websiteId, currentLiked) => {
    if (!user || likingRefs.current[websiteId]) return;
    const newLiked = !currentLiked;
    setWebsites((prev) =>
      prev.map((site) =>
        site.id === websiteId
          ? {
              ...site,
              like_count: newLiked ? site.like_count + 1 : site.like_count - 1,
              liked_by_user: newLiked,
            }
          : site
      )
    );
    likedRefs.current[websiteId] = newLiked;
    likingRefs.current[websiteId] = true;

    try {
      if (newLiked) await likeWork(websiteId, user.id);
      else await unlikeWork(websiteId, user.id);
    } catch (err) {
      console.error('点赞操作失败:', err);
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === websiteId
            ? {
                ...site,
                like_count: currentLiked ? site.like_count + 1 : site.like_count - 1,
                liked_by_user: currentLiked,
              }
            : site
        )
      );
      likedRefs.current[websiteId] = currentLiked;
    } finally {
      likingRefs.current[websiteId] = false;
      setWebsites((prev) => [...prev]);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) return;
    setSearchParams({ page: newPage });
    window.scrollTo(0, 0);
  };

  const getPaginationRange = () => {
    const total = totalPages;
    const range = [];
    const rangeWithDots = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= currentPage - 2 && i <= currentPage + 2)) range.push(i);
    }
    let l;
    range.forEach((i) => {
      if (l) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    });
    return rangeWithDots;
  };

  if (authLoading) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ym-text-secondary)' }}>加载中...</div>;
  }

  return (
    <div>
      <TopRankStrip />

      {loading ? (
        <div className="ym-grid">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="ym-alert ym-alert-error">{error}</div>
      ) : websites.length === 0 ? (
        <div className="ym-empty">
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>这里还没有网站</div>
          <div>点击右上角提交第一个网站</div>
        </div>
      ) : (
        <>
          <div className="ym-grid ym-grid-wide">
            {websites.map((site, index) => (
              <WorkCard
                key={site.id}
                site={site}
                index={index}
                page={currentPage}
                user={user && !isAnonymous ? user : null}
                liking={likingRefs.current[site.id]}
                onToggleLike={handleLikeToggle}
                onOpen={() => navigate(`/website/${site.id}`)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '28px', flexWrap: 'wrap' }}>
              <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)}>
                上一页
              </button>
              {getPaginationRange().map((item, idx) =>
                item === '...' ? (
                  <span key={`dots-${idx}`} style={{ color: 'var(--ym-text-muted)', padding: '0 4px' }}>…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={'ym-btn ym-btn-sm' + (item === currentPage ? ' ym-btn-primary' : ' ym-btn-ghost')}
                    disabled={item === currentPage}
                    onClick={() => handlePageChange(item)}
                  >
                    {item}
                  </button>
                )
              )}
              <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)}>
                下一页
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px', color: 'var(--ym-text-muted)' }}>
            共 {totalItems} 个网站，第 {currentPage}/{totalPages} 页
          </div>
        </>
      )}
    </div>
  );
}
