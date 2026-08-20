// 首页高分榜侧边小窗口：紧凑展示 Top 8，避免与主轮播重复强调。
// 标题过长时自动滚动展示（仅当文本超出容器宽度时启用滚动）。
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getTopRatedWorks } from '../services/works.js';

function MarqueeTitle({ text }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const check = () => {
      const overflow = inner.scrollWidth > outer.clientWidth;
      setScrolling(overflow);
      if (overflow) {
        const distance = inner.scrollWidth - outer.clientWidth;
        inner.style.setProperty('--ym-marquee-distance', `-${distance}px`);
      }
    };
    check();

    let rafId = null;
    const onResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(check);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(outer);
    observer.observe(inner);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [text]);

  return (
    <span ref={outerRef} className={'ym-top-rated-title' + (scrolling ? ' is-scrolling' : '')}>
      <span ref={innerRef} className="ym-marquee-text">{text}</span>
    </span>
  );
}

export function TopRatedSidebar() {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTopRatedWorks(8);
        if (!cancelled) setWorks(data);
      } catch (err) {
        console.warn('加载高分榜单失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <aside className="ym-section-block" aria-label="高分榜单">
      <h3 className="ym-section-title" style={{ margin: '0 0 14px', fontSize: '16px' }}>
        高分榜单
        <span className="ym-section-extra" style={{ fontSize: '12px' }}>按点赞</span>
      </h3>
      {loading ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: '52px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)' }} />
          ))}
        </div>
      ) : works.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)', textAlign: 'center', padding: '16px 0' }}>暂无作品</div>
      ) : (
        <ol className="ym-top-rated-list">
          {works.map((w, i) => (
            <li key={w.id}>
              <Link to={`/website/${w.id}`} className="ym-top-rated-item">
                <span className="ym-top-rated-rank" data-rank={i + 1}>{i + 1}</span>
                <span className="ym-top-rated-thumb">
                  {w.image_url ? (
                    <img src={w.image_url} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span>{(w.title || '作').trim()[0]}</span>
                  )}
                </span>
                <span className="ym-top-rated-info">
                  <MarqueeTitle text={w.title} />
                  <span className="ym-top-rated-meta">{w.username} · ⭐ {w.like_count || 0}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}