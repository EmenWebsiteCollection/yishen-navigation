// src/pages/DiscoverPage.jsx
// Issue #39 P1：作品发现（多入口 + 每日随机 + 标签筛选）
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getDiscoveryRail, getRandomWork } from '../services/discovery.js';
import { DISCOVERY_RAILS } from '../services/discovery-logic.js';
import { WorkCard } from '../components/WorkCard.jsx';
import '../styles/global.css';

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

  // 每日随机
  const [randomWork, setRandomWork] = useState(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomHint, setRandomHint] = useState('');

  const visibleRails = DISCOVERY_RAILS.filter((r) => !r.requiresAuth || !!user);

  const loadRail = useCallback(async (railId, append = false) => {
    try {
      setLoading(true);
      setError(null);
      const opts = {
        userId: user?.id || null,
        limit: PAGE_SIZE,
        excludeIds: append ? seen : [],
      };
      const list = await getDiscoveryRail(railId, opts);
      let filtered = tag
        ? list.filter((w) => (w.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase()))
        : list;
      setWorks((prev) => (append ? [...prev, ...filtered] : filtered));
      setSeen((prev) => [...prev, ...filtered.map((w) => w.id)]);
    } catch (e) {
      console.error(e);
      setError('加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [user, tag, seen]);

  useEffect(() => {
    setSeen([]);
    setWorks([]);
    loadRail(rail, false);
  }, [rail, tag, user]);

  const handleRandom = async () => {
    if (randomLoading) return;
    setRandomLoading(true);
    setRandomHint('');
    try {
      const w = await getRandomWork(seen);
      if (!w) {
        setRandomHint('暂时没有符合质量门槛的作品。');
        setRandomWork(null);
        return;
      }
      setRandomWork(w);
      const line =
        w.comment_count === 0
          ? '它还没有收到任何评论，去当第一个评论者吧。'
          : w.favorite_count > 0
            ? `小众宝藏：已有 ${w.favorite_count} 人收藏过它。`
            : `已收获 ${w.like_count} 个赞。`;
      setRandomHint(line);
    } catch (e) {
      console.error(e);
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '26px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>
            ✨ 作品发现
          </h1>
          <p style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            不只是按点赞数推荐——这里有多条入口，让每一件认真创作的作品都有机会被看见。
          </p>
        </div>

        {/* 每日随机 */}
        <div style={{ padding: '20px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '4px' }}>
                🎲 今天看点不一样的
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>
                从「有质量门槛」的作品池里随机抽一件（质量门槛：至少 1 赞或被编辑精选）。
              </div>
            </div>
            <button
              onClick={handleRandom}
              disabled={randomLoading}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--ym-accent)',
                color: 'var(--ym-accent-text-on)',
                border: 'none',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '15px',
                fontWeight: '500',
                cursor: randomLoading ? 'not-allowed' : 'pointer',
                opacity: randomLoading ? 0.6 : 1,
              }}
            >
              {randomLoading ? '抽取中...' : '抽一件'}
            </button>
          </div>
          {randomWork && (
            <div style={{ marginTop: '16px' }}>
              <WorkCard work={randomWork} />
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--ym-text-muted)' }}>
                {randomHint}
              </div>
            </div>
          )}
          {randomHint && !randomWork && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--ym-text-muted)' }}>{randomHint}</div>
          )}
        </div>

        {/* rail 切换 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {visibleRails.map((r) => {
            const active = rail === r.id;
            return (
              <button
                key={r.id}
                onClick={() => switchRail(r.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: '1px solid var(--ym-border)',
                  backgroundColor: active ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
                  color: active ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all var(--ym-transition)',
                }}
                title={r.desc}
              >
                {r.label}
                {r.requiresAuth && !user ? '（登录可见）' : ''}
              </button>
            );
          })}
        </div>

        {tag && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--ym-text-secondary)' }}>
            <span>正在按标签筛选：</span>
            <span style={{ backgroundColor: 'var(--ym-bg-subtle)', borderRadius: '10px', padding: '2px 10px', color: 'var(--ym-accent)' }}>#{tag}</span>
            <button
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('tag');
                setSearchParams(next);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--ym-text-muted)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
            >
              清除筛选
            </button>
          </div>
        )}

        {/* 列表 */}
        {loading && works.length === 0 ? (
          <div style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', padding: '40px 0', textAlign: 'center' }}>加载中...</div>
        ) : error ? (
          <div style={{ color: 'var(--ym-danger)', fontSize: '14px', padding: '20px 0' }}>{error}</div>
        ) : works.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ym-text-secondary)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>
              {rail === 'zero_comment' ? '🎉' : '🗺️'}
            </div>
            <div style={{ fontSize: '15px', marginBottom: '8px' }}>
              {rail === 'zero_comment' ? '当前没有零评论作品，说明大家都在被认真回应！' : '这个入口暂时还没有作品。'}
            </div>
            <Link to="/create" style={{ color: 'var(--ym-accent)', fontSize: '14px' }}>去发布你的第一件作品 →</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {works.map((w) => (
                <WorkCard key={w.id} work={w} />
              ))}
            </div>
            {works.length >= PAGE_SIZE && (
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button
                  onClick={() => loadRail(rail, true)}
                  disabled={loading}
                  style={{
                    padding: '10px 28px',
                    backgroundColor: 'transparent',
                    color: 'var(--ym-text-secondary)',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-sm)',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? '加载中...' : '加载更多'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
