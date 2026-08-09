import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero.jsx';
import { IdeaCard } from '../components/IdeaCard.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { getIdeas } from '../services/ideas.js';
import { IDEA_CATEGORIES, IDEA_STATUSES } from '../services/idea-logic.js';

const PAGE_SIZE = 10;

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
  const listTopRef = useRef(null);

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

  useEffect(() => { load(); }, [load]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setQuery(event.currentTarget.elements.search.value.trim());
  };

  const resetAnd = (setter) => {
    setPage(1);
    setter();
  };

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    window.requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="ym-content-page">
      <div className="ym-page-container">
        <PageHero
          emoji="光"
          title="灵感"
          subtitle="把脑洞说出来：点赞、收藏、讨论，被看中的想法会变成作品"
          className="ym-stagger-item"
          style={{ animationDelay: '0ms' }}
        />

        <div className="ym-idea-toolbar ym-stagger-item" style={{ animationDelay: '55ms' }}>
          <form className="ym-idea-search" onSubmit={handleSearch}>
            <input className="ym-input" name="search" defaultValue={query} placeholder="搜索想法…" aria-label="搜索想法" />
            <button type="submit" className="ym-btn ym-btn-primary">搜索</button>
          </form>
          <div className="ym-idea-actions">
            <button type="button" className={`ym-chip-button${sort === 'latest' ? ' is-active' : ''}`} onClick={() => resetAnd(() => setSort('latest'))}>最新</button>
            <button type="button" className={`ym-chip-button${sort === 'hot' ? ' is-active' : ''}`} onClick={() => resetAnd(() => setSort('hot'))}>最热</button>
            <Link to="/ideas/new" className="ym-btn ym-btn-primary">发布想法</Link>
          </div>
        </div>

        <div className="ym-chip-row ym-stagger-item" style={{ animationDelay: '110ms' }} aria-label="状态筛选">
          <button type="button" className={`ym-chip-button${status === '' ? ' is-active' : ''}`} onClick={() => resetAnd(() => setStatus(''))}>全部</button>
          {IDEA_STATUSES.map((item) => (
            <button key={item.id} type="button" className={`ym-chip-button${status === item.id ? ' is-active' : ''}`} onClick={() => resetAnd(() => setStatus(item.id))}>{item.label}</button>
          ))}
        </div>

        <div className="ym-chip-row ym-stagger-item" style={{ animationDelay: '165ms' }} aria-label="分类筛选">
          <button type="button" className={`ym-chip-button${category === '' ? ' is-active' : ''}`} onClick={() => resetAnd(() => setCategory(''))}>全部分类</button>
          {IDEA_CATEGORIES.map((item) => (
            <button key={item.id} type="button" className={`ym-chip-button${category === item.id ? ' is-active' : ''}`} onClick={() => resetAnd(() => setCategory(item.id))}>{item.label}</button>
          ))}
        </div>

        <div ref={listTopRef} className="ym-list-anchor" />
        {error && <div className="ym-alert ym-alert-error">{error}</div>}
        {ideas.length === 0 ? (
          loading ? null : (
            <div className="ym-empty">
              <h3>还没有符合条件的想法</h3>
              <p>换一个筛选条件，或者发布第一条想法。</p>
              <Link to="/ideas/new" className="ym-btn ym-btn-primary">发布想法</Link>
            </div>
          )
        ) : (
          <>
            <div className="ym-idea-list">
              {ideas.map((idea, i) => <IdeaCard key={idea.id} idea={idea} className="ym-stagger-item" style={{ animationDelay: `${220 + i * 55}ms` }} />)}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} totalItems={total} itemLabel="条想法" onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );
}
