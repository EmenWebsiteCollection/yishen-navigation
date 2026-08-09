// 首页高分网站轮播：每 5 秒自动切换，支持点选/暂停/减少动画偏好。
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const total = sites.length;

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
    return () => { cancelled = true; };
  }, []);

  const goTo = useCallback((i) => {
    if (total === 0) return;
    const next = ((i % total) + total) % total;
    setIndex(next);
    setProgressKey((k) => k + 1);
  }, [total]);

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [total, index]);

  useEffect(() => {
    if (total <= 1 || paused || reducedMotion.current) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % total);
      setProgressKey((k) => k + 1);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [total, paused]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
      else setPaused(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (loading) return <CarouselSkeleton />;
  if (total < MIN_SITES) return null;

  const current = sites[index];

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
        <div style={{ display: 'flex', transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)', transform: `translateX(-${index * 100}%)` }}>
          {sites.map((site, i) => <Slide key={site.id} site={site} index={i} />)}
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
          第 <b style={{ color: 'var(--ym-text-secondary)' }}>{String(index + 1).padStart(2, '0')}</b> / {String(total).padStart(2, '0')} 名
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
          {sites.map((site, i) => (
            <button
              key={site.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 名：${site.title}`}
              style={{
                width: i === index ? '22px' : '8px',
                height: '8px',
                border: 'none',
                borderRadius: i === index ? '4px' : '50%',
                backgroundColor: 'var(--ym-accent)',
                opacity: i === index ? 1 : 0.25,
                cursor: 'pointer',
                padding: 0,
                transition: 'width var(--ym-transition), opacity var(--ym-transition), border-radius var(--ym-transition)',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" disabled={index === 0} onClick={() => goTo(index - 1)}>
            ←
          </button>
          <button type="button" className="ym-btn ym-btn-ghost ym-btn-sm" disabled={index === total - 1} onClick={() => goTo(index + 1)}>
            →
          </button>
        </div>
      </div>
    </section>
  );
}
