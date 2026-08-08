// src/components/SearchBar.jsx — 网站搜索栏（Issue #19）
// 自包含组件：输入 → 防抖 → 服务端搜索 → 下拉结果（键盘/鼠标均可操作）。
// 集成只需在 HomePage 挂载 <SearchBar />（详见 docs/search-integration.md）。
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchWebsites, highlightHtml } from '../services/search.js';
import '../styles/search.css';

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 8;

export function SearchBar({ placeholder = '搜索网站：标题 / URL / 描述', autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const boxRef = useRef(null);
  const timerRef = useRef(null);
  const reqSeq = useRef(0);
  const navigate = useNavigate();

  // 防抖搜索
  useEffect(() => {
    const q = query.trim();
    clearTimeout(timerRef.current);
    if (!q) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const seq = ++reqSeq.current;
      try {
        const { results: rs } = await searchWebsites(q, { limit: RESULT_LIMIT });
        if (seq !== reqSeq.current) return;
        setResults(rs);
        setError(null);
        setOpen(true);
      } catch (err) {
        if (seq !== reqSeq.current) return;
        console.error('搜索失败:', err.message);
        setResults([]);
        setError('搜索失败，请稍后重试');
        setOpen(true);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  // 点击外部关闭下拉
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const go = (site) => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    navigate(`/website/${site.id}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[activeIndex]) go(results[activeIndex]);
      else if (results[0]) go(results[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const clear = () => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="ym-search" ref={boxRef}>
      <div className="ym-search-input-wrap">
        <input
          className="ym-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="搜索网站"
          autoComplete="off"
        />
        {loading && <span className="ym-search-spinner" aria-hidden="true" />}
        {query && !loading && (
          <button type="button" className="ym-search-clear" onClick={clear} aria-label="清空搜索">清除</button>
        )}
      </div>

      {open && (
        <div className="ym-search-dropdown" role="listbox" aria-label="搜索结果">
          {error ? (
            <div className="ym-search-empty">{error}</div>
          ) : !loading && results.length === 0 ? (
            <div className="ym-search-empty">未找到相关网站，换个关键词试试</div>
          ) : (
            results.map((site, i) => (
              <div
                key={site.id}
                role="option"
                aria-selected={i === activeIndex}
                className={'ym-search-item' + (i === activeIndex ? ' active' : '')}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => go(site)}
              >
                {/* highlightHtml 已先转义再注入 mark，安全（见 search.js 注释） */}
                <div
                  className="ym-search-item-title"
                  dangerouslySetInnerHTML={{ __html: highlightHtml(site.title, query) }}
                />
                <div className="ym-search-item-url">{site.url}</div>
                {site.description && (
                  <div
                    className="ym-search-item-desc"
                    dangerouslySetInnerHTML={{ __html: highlightHtml(site.description, query) }}
                  />
                )}
                <div className="ym-search-item-meta">
                  <span>❤️ {site.like_count || 0}</span>
                  {site.username && <span>👤 {site.username}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
