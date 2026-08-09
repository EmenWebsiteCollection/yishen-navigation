// 首页高分网站轮播：每 5 秒自动切换，首尾相接无缝循环。
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTopRatedWorks } from '../services/works.js';

const ROTATE_INTERVAL = 5000;
const MIN_SITES = 3;

function CarouselSkeleton() {
  return (
    <div className="ym-section-block ym-skeleton">
      <div style={{ height: '16px', width: '160px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '4px', marginBottom: '14px' }} />
      <div style={{ aspectRatio: '16/6', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '8px' }} />
    </div>
  );
}

function Slide({ site, index }) {
  return (
    <div className="ym-carousel-slide" style={{ flex: '0 0 100%', minWidth: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 4fr)' }}>
      <div style={{ position: 'relative', minHeight: '280px', backgroundColor: 'var(--ym-bg-subtle)', overflow: 'hidden' }}>
        {site.image_url ? (
          <img
            src={site.image_url}
            alt={site.title}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ym-font-display)', fontSize: '72px', color: 'var(--ym-text-muted)', background: 'linear-gradient(135deg, var(--ym-bg-subtle), var(--ym-border))' }}>
            {(site.title || '网').trim()[0]}
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.35), rgba(0,0,0,0) 55%)' }} />
        <div style={{ position: 'absolute', left: '16px', bottom: '14px', color: 'var(--ym-bg-card)', fontSize: '12px', letterSpacing: '1px', textShadow: '0 1px 8px rgba(0,0,0,0.45)' }}>
          高分榜单 · 第 {String(index + 1).padStart(2, '0')} 名
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '28px', backgroundColor: 'var(--ym-bg-card)' }}>
        <span className="ym-chip ym-chip-active" style={{ alignSelf: 'flex-start' }}>
          ⭐ {site.like_count || 0} 赞
        </span>
        <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '22px', fontWeight: '600', color: 'var(--ym-text-primary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
          {site.title}
        </h3>
        <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--ym-text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
          {site.description || '暂无详情，点击查看完整介绍。'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: 'auto' }}>
          <Link to={`/user/${site.user_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--ym-text-muted)', textDecoration: 'none' }}>
            {site.avatar_url ? <img className="ym-avatar ym-avatar-sm" src={site.avatar_url} alt="" loading="lazy" decoding="async" /> : <span className="ym-avatar-fallback ym-avatar-sm" style={{ fontSize: '11px' }}>👤</span>}
            {site.username}
          </Link>
          <Link to={`/website/${site.id}`} className="ym-btn ym-btn-primary ym-btn-sm">
            查看详情
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HighRatedCarousel() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  // currentIndex 是扩展数组中的位置（0 = 末位克隆, 1~N = 真实, N+1 = 首位克隆）
  const [currentIndex, setCurrentIndex] = useState(1);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [noTransition, setNoTransition] = useState(false);
  const slideTrackRef = useRef(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const total = sites.length;

  // 扩展数组：[末位克隆, site0, site1, ..., siteN-1, 首位克隆]
  const extendedSlides = useMemo(() => {
    if (total === 0) return [];
    return [sites[total - 1], ...sites, sites[0]];
  }, [sites, total]);

  // 真实展示序号（0-based）
  const displayIndex = total > 0 ? ((currentIndex - 1) + total) % total : 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTopRatedWorks(8, { diversify: true });
        if (!cancelled) setSites(data);
      } catch (err) {
        console.warn('加载高分网站失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 过渡结束后，如果在克隆位置则瞬间跳回真实位置
  const handleTransitionEnd = useCallback((e) => {
    // 只响应 transform 过渡，忽略子元素冒泡上来的其他属性过渡
    if (e.propertyName !== 'transform') return;
    const idx = currentIndexRef.current;
    if (idx === 0) {
      // 到达末位克隆 → 跳到真实末位
      setNoTransition(true);
      setCurrentIndex(total);
    } else if (idx > total) {
      // 到达首位克隆 → 跳到真实首位
      setNoTransition(true);
      setCurrentIndex(1);
    }
  }, [total]);

  // noTransition 标志位在一帧后复位，让下次切换恢复动画
  useEffect(() => {
    if (!noTransition) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        setNoTransition(false);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [noTransition]);

  // 圆点导航（真实序号 → 扩展位置）
  const goTo = useCallback((realIndex) => {
    if (total === 0) return;
    setCurrentIndex(realIndex + 1);
    setProgressKey((k) => k + 1);
  }, [total]);

  // 向前/向后（直接操作扩展位置，边界由 handleTransitionEnd 处理）
  const goPrev = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((i) => i - 1);
    setProgressKey((k) => k + 1);
  }, [total]);

  const goNext = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((i) => i + 1);
    setProgressKey((k) => k + 1);
  }, [total]);

  // 自动轮播
  useEffect(() => {
    if (total <= 1 || paused) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => i + 1);
      setProgressKey((k) => k + 1);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [total, paused]);

  // 页面隐藏时暂停
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
      else setPaused(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!loading && total < MIN_SITES) return null;

  return (
    <section
      aria-label="高分网站轮播"
      style={{ marginBottom: '28px' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <h2 className="ym-section-title">
        高分榜单
        <span className="ym-section-extra">按点赞自动轮播 · 每 5 秒</span>
      </h2>

      <div className="ym-section-block" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          ref={slideTrackRef}
          onTransitionEnd={handleTransitionEnd}
          style={{
            display: 'flex',
            transition: noTransition ? 'none' : 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {extendedSlides.map((site, i) => (
            <Slide key={`${site.id}-${i}`} site={site} index={(i - 1 + total) % total} />
          ))}
        </div>
        <div style={{ height: '3px', backgroundColor: 'var(--ym-border)' }}>
          <div
            key={progressKey}
            style={{
              height: '100%',
              backgroundColor: 'var(--ym-accent)',
              transformOrigin: 'left',
              animation: paused ? 'none' : 'ym-hrc-progress 5s linear forwards',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>
          第 <b style={{ color: 'var(--ym-text-secondary)' }}>{String(displayIndex + 1).padStart(2, '0')}</b> / {String(total).padStart(2, '0')} 名
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
          {sites.map((site, i) => (
            <button
              key={site.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 名：${site.title}`}
              style={{
                width: i === displayIndex ? '22px' : '8px',
                height: '8px',
                border: 'none',
                borderRadius: i === displayIndex ? '4px' : '50%',
                backgroundColor: 'var(--ym-accent)',
                opacity: i === displayIndex ? 1 : 0.25,
                cursor: 'pointer',
                padding: 0,
                transition: 'width var(--ym-transition), opacity var(--ym-transition), border-radius var(--ym-transition)',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" onClick={goPrev}>
            ←
          </button>
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" onClick={goNext}>
            →
          </button>
        </div>
      </div>
    </section>
  );
}
