// 首页：高分轮播 + 可配置分区 Tab + B 站式网站卡片信息流。
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWorks, likeWork, unlikeWork } from '../services/works.js';
import { getPartitions } from '../services/partitions.js';
import { supabase } from '../services/supabase.js';
import { HighRatedCarousel } from '../components/HighRatedCarousel.jsx';
import { PartitionManager } from '../components/PartitionManager.jsx';
import { Pagination, PAGE_SIZE_MAX } from '../components/Pagination.jsx';

const PAGE_SIZE_DEFAULT = 10;

const SkeletonCard = () => (
  <div className="ym-card ym-skeleton">
    <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--ym-bg-subtle)' }} />
    <div style={{ padding: '14px 16px' }}>
      <div style={{ height: '16px', width: '70%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ height: '13px', width: '50%', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px' }} />
    </div>
  </div>
);

function WorkCard({ site, index, page, pageSize, user, liking, onToggleLike, onRequireLogin, onOpen }) {
  const isLiked = site.liked_by_user || false;
  return (
    <div className="ym-card ym-stagger-item" onClick={onOpen} style={{ animationDelay: `${(index % 10) * 60}ms`, cursor: 'pointer' }}>
      <div className="ym-card-media">
        <span className="ym-card-badge">{String((page - 1) * pageSize + index + 1).padStart(2, '0')}</span>
        <div className="ym-card-media-fallback">{(site.title || '网').trim()[0]}</div>
        {site.image_url && (
          <img src={site.image_url} alt={site.title} loading="lazy" decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <span>👁 {site.view_count || 0}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  onRequireLogin();
                  return;
                }
                onToggleLike(site.id, isLiked);
              }}
              disabled={liking}
              style={{
                border: 'none',
                background: 'none',
                color: isLiked ? 'var(--ym-accent)' : 'var(--ym-text-muted)',
                cursor: liking ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: isLiked ? '600' : '400',
                whiteSpace: 'nowrap',
              }}
            >
              {isLiked ? '♥' : '♡'} {site.like_count || 0}
            </button>
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
  // pageSize 也同步到 URL（?size=20），刷新后保持每页数量
  const pageSize = parseInt(searchParams.get('size') || String(PAGE_SIZE_DEFAULT), 10);
  const normalizedSize = Number.isFinite(pageSize)
    ? Math.min(PAGE_SIZE_MAX, Math.max(1, pageSize))
    : PAGE_SIZE_DEFAULT;
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const likedRefs = useRef({});
  const likingRefs = useRef({});
  const listTopRef = useRef(null);
  const pendingListScrollRef = useRef(false);

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
      const { works: data, total } = await getWorks({ page, pageSize: normalizedSize, type });
      setTotalItems(total);
      setTotalPages(Math.ceil(total / normalizedSize) || 1);

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

  useEffect(() => {
    if (loading || !pendingListScrollRef.current) return undefined;

    pendingListScrollRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loading, currentPage, normalizedSize, partitionId]);

  const handleLikeToggle = async (websiteId, currentLiked) => {
    if (!user || likingRefs.current[websiteId]) return;
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
    if (id === partitionId) return;
    pendingListScrollRef.current = true;
    setLoading(true);
    const params = { page: '1' };
    if (normalizedSize !== PAGE_SIZE_DEFAULT) params.size = String(normalizedSize);
    if (id !== 'all') params.partition = id;
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) return;
    pendingListScrollRef.current = true;
    setLoading(true);
    const params = { page: String(newPage) };
    if (normalizedSize !== PAGE_SIZE_DEFAULT || searchParams.has('size')) {
      params.size = String(normalizedSize);
    }
    if (partitionId !== 'all') params.partition = partitionId;
    setSearchParams(params);
  };

  const handlePageSizeChange = (size) => {
    if (size === normalizedSize) return;
    pendingListScrollRef.current = true;
    setLoading(true);
    // 每页数量写入 URL，页码回到第 1 页（避免超出新页数上限）
    const params = { page: '1', size: String(size) };
    if (partitionId !== 'all') params.partition = partitionId;
    setSearchParams(params);
  };

  if (authLoading) return null;

  return (
    <div className="ym-home-page">
      <HighRatedCarousel />

      <div className="ym-home-feature-grid">
        <Link
          to="/ideas"
          className="ym-home-feature ym-glass-panel ym-stagger-item"
          style={{ animationDelay: '0ms' }}
        >
          <div className="ym-home-feature-copy">
            <div>
              <strong>灵感</strong>
              <p>把脑洞说出来：点赞、收藏、讨论，被看中的想法会变成作品</p>
            </div>
          </div>
          <span className="ym-btn ym-btn-primary ym-btn-sm">去逛逛</span>
        </Link>

        <Link
          to="/discover"
          className="ym-home-feature ym-glass-panel ym-stagger-item"
          style={{ animationDelay: '60ms' }}
        >
          <div>
            <strong>作品发现</strong>
            <p>
              本周新锐 · 编辑精选 · 小众宝藏 · 零评论作品 · 每日随机……不只按点赞数推荐
            </p>
          </div>
          <span className="ym-btn ym-btn-primary ym-btn-sm">去看看</span>
        </Link>
      </div>

      <div ref={listTopRef} className="ym-flex-between ym-list-anchor ym-stagger-item" style={{ animationDelay: '120ms', marginBottom: '8px' }}>
        <h2 className="ym-section-title" style={{ margin: '24px 0 12px' }}>全部作品</h2>
        {isLoggedIn && (
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" onClick={() => setShowPartitionManager(true)}>
            管理分区
          </button>
        )}
      </div>

      <div className="ym-tabs ym-stagger-item" role="tablist" aria-label="作品分区" style={{ animationDelay: '180ms' }}>
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
        <div className="ym-grid ym-skeleton-grid">
          {Array.from({ length: normalizedSize }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="ym-alert ym-alert-error">{error}</div>
      ) : websites.length === 0 ? (
        loading ? null : (
          <div className="ym-empty">
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>这个分区还没有作品</div>
            <div>点击右上角提交第一个作品</div>
          </div>
        )
      ) : (
        <>
          <div className="ym-grid ym-grid-wide">
            {websites.map((site, index) => (
              <WorkCard
                key={site.id}
                site={site}
                index={index}
                page={currentPage}
                pageSize={normalizedSize}
                user={isLoggedIn ? user : null}
                liking={likingRefs.current[site.id]}
                onToggleLike={handleLikeToggle}
                onRequireLogin={() => navigate('/login')}
                onOpen={() => navigate(`/website/${site.id}`)}
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemLabel="个作品"
            onPageChange={handlePageChange}
            pageSize={normalizedSize}
            onPageSizeChange={handlePageSizeChange}
          />
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

