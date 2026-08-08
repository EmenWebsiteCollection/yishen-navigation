// 首页：高分轮播 + 可配置分区 Tab + B 站式网站卡片信息流。
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWorks, likeWork, unlikeWork } from '../services/works.js';
import { getPartitions } from '../services/partitions.js';
import { supabase } from '../services/supabase.js';
import { HighRatedCarousel } from '../components/HighRatedCarousel.jsx';
import { PartitionManager } from '../components/PartitionManager.jsx';

const PAGE_SIZE = 12;

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
    <div className="ym-card" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="ym-card-media">
        <span className="ym-card-badge">{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}</span>
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
          <Link to={`/user/${site.user_id}`} onClick={(e) => e.stopPropagation()} className="ym-card-author" style={{ textDecoration: 'none' }}>
            {site.avatar_url ? (
              <img className="ym-avatar ym-avatar-sm" src={site.avatar_url} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="ym-avatar-fallback ym-avatar-sm" style={{ fontSize: '11px' }}>👤</span>
            )}
            <span>{site.username}</span>
          </Link>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (user) onToggleLike(site.id, site.liked_by_user || false); }}
              disabled={liking}
              title={user ? (site.liked_by_user ? '取消点赞' : '点赞') : '登录后点赞'}
              style={{
                border: 'none',
                background: 'none',
                color: site.liked_by_user ? 'var(--ym-accent)' : 'var(--ym-text-muted)',
                cursor: liking ? 'not-allowed' : (user ? 'pointer' : 'default'),
                fontSize: '12px',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ❤️ {site.like_count || 0}
            </button>
            <span>👁 {site.view_count || 0}</span>
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
  const [partitions, setPartitions] = useState([]);
  const [partitionsLoaded, setPartitionsLoaded] = useState(false);
  const [showPartitionManager, setShowPartitionManager] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const likedRefs = useRef({});
  const likingRefs = useRef({});

  const partitionId = searchParams.get('partition') || 'all';
  const activePartition = partitions.find((p) => p.id === partitionId) || null;
  const activeType = activePartition ? activePartition.work_type : null;
  const isLoggedIn = Boolean(user && !isAnonymous);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getPartitions();
      if (!cancelled) {
        setPartitions(list);
        setPartitionsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadWebsites = async (page, type) => {
    try {
      setLoading(true);
      setError(null);
      const { works: data, total } = await getWorks({ page, pageSize: PAGE_SIZE, type });
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
    if (!partitionsLoaded) return;
    const page = parseInt(searchParams.get('page') || '1', 10);
    if (page > 0) loadWebsites(page, activeType);
  }, [searchParams, user, partitionsLoaded, activeType]);

  const handleLikeToggle = async (websiteId, currentLiked) => {
    if (!user || isAnonymous || likingRefs.current[websiteId]) return;
    const newLiked = !currentLiked;
    setWebsites((prev) =>
      prev.map((site) =>
        site.id === websiteId
          ? { ...site, like_count: newLiked ? site.like_count + 1 : site.like_count - 1, liked_by_user: newLiked }
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
            ? { ...site, like_count: currentLiked ? site.like_count + 1 : site.like_count - 1, liked_by_user: currentLiked }
            : site
        )
      );
      likedRefs.current[websiteId] = currentLiked;
    } finally {
      likingRefs.current[websiteId] = false;
      setWebsites((prev) => [...prev]);
    }
  };

  const handlePartitionClick = (id) => {
    const params = { page: '1' };
    if (id !== 'all') params.partition = id;
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) return;
    const params = { page: String(newPage) };
    if (partitionId !== 'all') params.partition = partitionId;
    setSearchParams(params);
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
      <HighRatedCarousel />

      <div style={{ display: 'grid', gap: '12px', marginBottom: '8px' }}>
        <Link
          to="/ideas"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '16px 20px',
            borderRadius: 'var(--ym-radius-md)',
            backgroundColor: 'var(--ym-bg-card)',
            border: '1px solid var(--ym-border)',
            textDecoration: 'none',
            transition: 'all var(--ym-transition)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ym-border-strong)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ym-border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>💡</span>
            <div>
              <div style={{ fontFamily: 'var(--ym-font-display)', fontSize: '16px', fontWeight: '500', color: 'var(--ym-text-primary)' }}>想法集中营</div>
              <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>把脑洞说出来：点赞、收藏、讨论，被看中的想法会变成作品</div>
            </div>
          </div>
          <span style={{ padding: '6px 16px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', fontSize: '13px', fontWeight: '500' }}>去逛逛 →</span>
        </Link>

        <Link
          to="/discover"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            textDecoration: 'none',
            padding: '16px 20px',
            backgroundColor: 'var(--ym-bg-card)',
            border: '1px solid var(--ym-border)',
            borderRadius: 'var(--ym-radius-md)',
            transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ym-accent)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--ym-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '4px' }}>
              ✨ 作品发现
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ym-text-secondary)' }}>
              本周新锐 · 编辑精选 · 小众宝藏 · 零评论作品 · 每日随机……不只按点赞数推荐
            </div>
          </div>
          <span style={{ color: 'var(--ym-accent)', fontSize: '14px', whiteSpace: 'nowrap' }}>去看看 →</span>
        </Link>
      </div>

      <div className="ym-flex-between" style={{ marginBottom: '8px' }}>
        <h2 className="ym-section-title" style={{ margin: '24px 0 12px' }}>全部作品</h2>
        {isLoggedIn && (
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" onClick={() => setShowPartitionManager(true)}>
            管理分区
          </button>
        )}
      </div>

      <div className="ym-tabs" role="tablist" aria-label="作品分区">
        <button
          type="button"
          role="tab"
          aria-selected={partitionId === 'all'}
          className={'ym-tab' + (partitionId === 'all' ? ' active' : '')}
          onClick={() => handlePartitionClick('all')}
        >
          全部
        </button>
        {partitions.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={partitionId === p.id}
            className={'ym-tab' + (partitionId === p.id ? ' active' : '')}
            onClick={() => handlePartitionClick(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ym-grid">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="ym-alert ym-alert-error">{error}</div>
      ) : websites.length === 0 ? (
        <div className="ym-empty">
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>这个分区还没有作品</div>
          <div>点击右上角提交第一个作品</div>
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
                user={isLoggedIn ? user : null}
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
            共 {totalItems} 个作品，第 {currentPage}/{totalPages} 页
          </div>
        </>
      )}

      <PartitionManager
        open={showPartitionManager}
        onClose={() => setShowPartitionManager(false)}
        onChanged={() => {
          getPartitions().then(setPartitions);
          const page = parseInt(searchParams.get('page') || '1', 10);
          loadWebsites(page, activeType);
        }}
      />
    </div>
  );
}
