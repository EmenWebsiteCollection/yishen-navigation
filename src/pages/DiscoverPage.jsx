import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getDiscoveryRail, getRandomWork } from '../services/discovery.js';
import { DISCOVERY_RAILS } from '../services/discovery-logic.js';
import { WorkCard } from '../components/WorkCard.jsx';
import { PageHero } from '../components/PageHero.jsx';

const PAGE_SIZE = 12;

export function DiscoverPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rail = searchParams.get('rail') || 'latest';
  const tag = searchParams.get('tag') || '';
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seen, setSeen] = useState([]);
  const [randomWork, setRandomWork] = useState(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomHint, setRandomHint] = useState('');
  const visibleRails = DISCOVERY_RAILS.filter((item) => !item.requiresAuth || Boolean(user));

  const loadRail = useCallback(async (railId, append = false) => {
    try {
      setLoading(true);
      setError(null);
      const list = await getDiscoveryRail(railId, {
        userId: user?.id || null,
        limit: PAGE_SIZE,
        excludeIds: append ? seen : [],
      });
      const filtered = tag
        ? list.filter((work) => (work.tags || []).some((item) => item.toLowerCase() === tag.toLowerCase()))
        : list;
      setWorks((previous) => (append ? [...previous, ...filtered] : filtered));
      setSeen((previous) => [...previous, ...filtered.map((work) => work.id)]);
    } catch (err) {
      console.error(err);
      setError('加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [user, tag, seen]);

  useEffect(() => {
    setSeen([]);
    setWorks([]);
    loadRail(rail, false);
    // loadRail 会随已浏览作品变化，仅在入口条件改变时重新加载。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rail, tag, user]);

  const handleRandom = async () => {
    if (randomLoading) return;
    setRandomLoading(true);
    setRandomHint('');
    try {
      const work = await getRandomWork(seen);
      if (!work) {
        setRandomHint('暂时没有符合质量门槛的作品。');
        setRandomWork(null);
        return;
      }
      setRandomWork(work);
      setRandomHint(
        work.comment_count === 0
          ? '它还没有收到任何评论，去当第一个评论者吧。'
          : work.favorite_count > 0
            ? `小众宝藏：已有 ${work.favorite_count} 人收藏过它。`
            : `已收获 ${work.like_count} 个赞。`
      );
    } catch (err) {
      console.error(err);
      setRandomHint('随机抽取失败，请稍后再试。');
    } finally {
      setRandomLoading(false);
    }
  };

  const switchRail = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('rail', id);
    if (tag) next.set('tag', tag);
    setSearchParams(next);
  };

  return (
    <div className="ym-content-page">
      <div className="ym-page-container ym-page-container-wide">
        <PageHero
          emoji="览"
          title="作品发现"
          subtitle="不只是按点赞数推荐——这里有多条入口，让每一件认真创作的作品都有机会被看见。"
          className="ym-stagger-item"
          style={{ animationDelay: '0ms' }}
        />

        <section className="ym-discovery-random ym-glass-panel ym-stagger-item" style={{ animationDelay: '60ms' }}>
          <div className="ym-discovery-random-head">
            <div>
              <h2 className="ym-discovery-random-title">今天看点不一样的</h2>
              <p className="ym-discovery-random-copy">从有质量门槛的作品池里随机抽一件：至少 1 赞或被编辑精选。</p>
            </div>
            <button type="button" className="ym-btn ym-btn-primary ym-btn-lg" onClick={handleRandom} disabled={randomLoading}>
              {randomLoading ? '抽取中…' : '抽一件'}
            </button>
          </div>
          {randomWork && (
            <div className="ym-random-result">
              <WorkCard work={randomWork} />
              <p>{randomHint}</p>
            </div>
          )}
          {randomHint && !randomWork && <p className="ym-discovery-random-copy ym-random-hint">{randomHint}</p>}
        </section>

        <div className="ym-filter-rail ym-stagger-item" aria-label="发现入口" style={{ animationDelay: '120ms' }}>
          {visibleRails.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ym-chip-button${rail === item.id ? ' is-active' : ''}`}
              onClick={() => switchRail(item.id)}
              title={item.desc}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tag && (
          <div className="ym-active-filter">
            <span>正在按标签筛选：</span><span className="ym-work-badge">#{tag}</span>
            <button type="button" className="ym-btn ym-btn-sm" onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('tag');
              setSearchParams(next);
            }}>清除筛选</button>
          </div>
        )}

        {error ? (
          <div className="ym-alert ym-alert-error">{error}</div>
        ) : works.length === 0 ? (
            <div className="ym-empty">
              <h3>{rail === 'zero_comment' ? '当前没有零评论作品' : '这个入口暂时还没有作品'}</h3>
              <p>{rail === 'zero_comment' ? '说明大家都在被认真回应。' : '发布你的第一件作品，让它在这里被看见。'}</p>
              <Link to="/create" className="ym-btn ym-btn-primary">发布作品</Link>
            </div>
        ) : (
          <>
            <div className="ym-grid ym-grid-wide">
              {works.map((work, i) => <WorkCard key={work.id} work={work} className="ym-stagger-item" style={{ animationDelay: `${(i % 12) * 60}ms` }} />)}
            </div>
            {works.length >= PAGE_SIZE && (
              <div className="ym-load-more">
                <button type="button" className="ym-btn ym-btn-lg" onClick={() => loadRail(rail, true)} disabled={loading}>
                  {loading ? '加载中…' : '加载更多'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
