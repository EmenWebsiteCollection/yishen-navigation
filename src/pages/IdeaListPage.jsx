// src/pages/IdeaListPage.jsx
// Issue #12 想法集中营：列表（分类/状态/排序/搜索/分页）
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero.jsx';
import { IdeaCard } from '../components/IdeaCard.jsx';
import { getIdeas } from '../services/ideas.js';
import { IDEA_CATEGORIES, IDEA_STATUSES } from '../services/idea-logic.js';
import '../styles/global.css';

const PAGE_SIZE = 10;

const chipStyle = (active) => ({
  padding: '6px 14px',
  borderRadius: '20px',
  border: '1px solid var(--ym-border)',
  backgroundColor: active ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
  color: active ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
  cursor: 'pointer',
  fontSize: '13px',
  transition: 'all var(--ym-transition)',
});

export function IdeaListPage() {
  const [ideas, setIdeas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('latest');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { ideas: list, total: count } = await getIdeas({
        page,
        pageSize: PAGE_SIZE,
        category: category || null,
        status: status || null,
        sort,
        query: query || null,
      });
      setIdeas(list);
      setTotal(count);
    } catch (err) {
      console.error('加载想法失败:', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [page, category, status, sort, query]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(e.target.search.value.trim());
  };

  const resetAnd = (fn) => {
    setPage(1);
    fn();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = totalPages > 1;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--ym-bg-page)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 20px 60px' }}>
        <PageHero
          emoji="💡"
          title="想法集中营"
          subtitle="把脑洞说出来：点赞、收藏、讨论，被看中的想法会变成作品"
        />

        {/* 操作区 */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '220px', maxWidth: '360px' }}>
            <input
              name="search"
              defaultValue={query}
              placeholder="搜索想法…"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--ym-border)',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '14px',
                backgroundColor: 'var(--ym-bg-card)',
                color: 'var(--ym-text-primary)',
                fontFamily: 'var(--ym-font-body)',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--ym-accent)',
                color: 'var(--ym-accent-text-on)',
                border: 'none',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              搜索
            </button>
          </form>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => resetAnd(() => setSort('latest'))} style={chipStyle(sort === 'latest')}>最新</button>
            <button type="button" onClick={() => resetAnd(() => setSort('hot'))} style={chipStyle(sort === 'hot')}>最热</button>
            <Link
              to="/ideas/new"
              style={{
                padding: '8px 18px',
                backgroundColor: 'var(--ym-success)',
                color: 'var(--ym-success-text-on)',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ✍️ 发布想法
            </Link>
          </div>
        </div>

        {/* 状态 Tab */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button type="button" onClick={() => resetAnd(() => setStatus(''))} style={chipStyle(status === '')}>全部</button>
          {IDEA_STATUSES.map((s) => (
            <button key={s.id} type="button" onClick={() => resetAnd(() => setStatus(s.id))} style={chipStyle(status === s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        {/* 分类 chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button type="button" onClick={() => resetAnd(() => setCategory(''))} style={chipStyle(category === '')}>全部分类</button>
          {IDEA_CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => resetAnd(() => setCategory(c.id))} style={chipStyle(category === c.id)}>
              {c.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', marginBottom: '16px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: 'var(--ym-danger-bg)', color: 'var(--ym-danger)', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ym-text-muted)' }}>加载中…</div>
        ) : ideas.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              backgroundColor: 'var(--ym-bg-card)',
              border: '1px dashed var(--ym-border)',
              borderRadius: 'var(--ym-radius-lg)',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌱</div>
            <p style={{ fontSize: '15px', color: 'var(--ym-text-secondary)', marginBottom: '16px' }}>
              还没有符合条件想法，来发布第一条吧
            </p>
            <Link
              to="/ideas/new"
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--ym-accent)',
                color: 'var(--ym-accent-text-on)',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              发布第一个想法
            </Link>
          </div>
        ) : (
          <>
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
            {showPagination && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{
                    padding: '6px 16px',
                    fontSize: '13px',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: 'var(--ym-bg-card)',
                    color: page <= 1 ? 'var(--ym-text-muted)' : 'var(--ym-text-secondary)',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  上一页
                </button>
                <span style={{ fontSize: '13px', color: 'var(--ym-text-secondary)' }}>
                  第 {page} / {totalPages} 页（共 {total} 条）
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: '6px 16px',
                    fontSize: '13px',
                    border: '1px solid var(--ym-border)',
                    borderRadius: 'var(--ym-radius-sm)',
                    backgroundColor: 'var(--ym-bg-card)',
                    color: page >= totalPages ? 'var(--ym-text-muted)' : 'var(--ym-text-secondary)',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
