// src/components/HighRatedCarousel.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getTopRatedWorks } from '../services/works.js';
import '../styles/high-rated.css';

const ROTATE_INTERVAL = 5000;
const MIN_SITES = 3;

const CarouselSkeleton = () => (
  <div className="ym-hrc-skeleton">
    <div className="ym-hrc-skeleton-media" />
    <div className="ym-hrc-skeleton-body">
      <div className="ym-hrc-skeleton-line" style={{ width: '30%' }} />
      <div className="ym-hrc-skeleton-line" style={{ width: '60%' }} />
      <div className="ym-hrc-skeleton-line" style={{ width: '45%' }} />
    </div>
  </div>
);

const Slide = ({ site, index }) => (
  <div className="ym-hrc-slide" aria-roledescription="slide" aria-label={`第 ${index + 1} 名：${site.title}`}>
    <div className="ym-hrc-media">
      <div className="ym-hrc-media-fallback">
        <span className="ym-hrc-letter">{(site.title || '网').trim()[0]}</span>
      </div>
      {site.image_url && (
        <img
          src={site.image_url}
          alt={site.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="ym-hrc-shade" />
      <div className="ym-hrc-rank">
        <span className="ym-hrc-rank-num">{String(index + 1).padStart(2, '0')}</span>
        <span className="ym-hrc-rank-label">高分榜单</span>
      </div>
    </div>

    <div className="ym-hrc-info">
      <span className="ym-hrc-score">
        <span className="ym-hrc-score-star">⭐</span>
        <span className="ym-hrc-score-value">{site.like_count}</span>
        <span className="ym-hrc-score-unit">分</span>
      </span>
      <h3 className="ym-hrc-title-text">{site.title}</h3>
      <p className="ym-hrc-desc">{site.description || '暂无详情，点击查看完整介绍。'}</p>
      <div className="ym-hrc-footer">
        <span className="ym-hrc-author">👤 {site.username}</span>
        <Link to={`/website/${site.id}`} className="ym-hrc-btn">
          查看详情 →
        </Link>
      </div>
    </div>
  </div>
);

export function HighRatedCarousel() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);

  const reducedMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

  // 自动轮换：每 5 秒按评分名次 +1
  useEffect(() => {
    if (total <= 1 || paused || reducedMotion.current) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % total);
      setProgressKey((k) => k + 1);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [total, paused]);

  // 切换标签页时暂停，避免后台空转
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
      else setPaused(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (loading) {
    return <CarouselSkeleton />;
  }

  if (total < MIN_SITES) {
    return null;
  }

  const current = sites[index];
  const lastIndex = total - 1;

  return (
    <section
      className="ym-hrc"
      aria-label="高分网站轮播"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ym-hrc-header">
        <div className="ym-hrc-heading">
          <h2 className="ym-hrc-title">
            ⭐ 高分网站
            <span className="ym-hrc-title-badge">TOP</span>
          </h2>
          <span className="ym-hrc-subtitle">按评分自动轮播 · 每 5 秒</span>
        </div>
      </div>

      <div className="ym-hrc-viewport">
        <div
          className="ym-hrc-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {sites.map((site, i) => (
            <Slide key={site.id} site={site} index={i} />
          ))}
        </div>
        <div className={`ym-hrc-progress${paused ? ' is-paused' : ''}`}>
          <div key={progressKey} className="ym-hrc-progress-bar" />
        </div>
      </div>

      <div className="ym-hrc-nav">
        <span className="ym-hrc-counter">
          第 <b>{String(index + 1).padStart(2, '0')}</b> / {String(total).padStart(2, '0')} 名
        </span>

        <div className="ym-hrc-dots" role="tablist" aria-label="选择展位">
          {sites.map((site, i) => (
            <button
              key={site.id}
              className={`ym-hrc-dot${i === index ? ' active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 名：${site.title}`}
              aria-selected={i === index}
              role="tab"
            />
          ))}
        </div>

        <div className="ym-hrc-arrows">
          <button
            className="ym-hrc-arrow"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="上一名"
          >
            ←
          </button>
          <button
            className="ym-hrc-arrow"
            onClick={() => goTo(index + 1)}
            disabled={index === lastIndex}
            aria-label="下一名"
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
