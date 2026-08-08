import React, { useEffect, useMemo, useState } from 'react';

function buildPagination(currentPage, totalPages, siblingCount = 2) {
  if (totalPages <= 1) return [1];

  const visible = new Set([1, totalPages]);
  const start = Math.max(2, currentPage - siblingCount);
  const end = Math.min(totalPages - 1, currentPage + siblingCount);

  for (let page = start; page <= end; page += 1) visible.add(page);

  const pages = [...visible].sort((a, b) => a - b);
  const result = [];

  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous && page - previous === 2) result.push(previous + 1);
    if (previous && page - previous > 2) result.push(`ellipsis-${previous}-${page}`);
    result.push(page);
  });

  return result;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemLabel = '个作品',
  showJump = true,
}) {
  const [jumpValue, setJumpValue] = useState(String(currentPage));
  const [jumpError, setJumpError] = useState('');
  const items = useMemo(
    () => buildPagination(currentPage, totalPages),
    [currentPage, totalPages]
  );

  useEffect(() => {
    setJumpValue(String(currentPage));
    setJumpError('');
  }, [currentPage]);

  const submitJump = (event) => {
    event.preventDefault();
    const value = jumpValue.trim();

    if (!/^\d+$/.test(value)) {
      setJumpError('请输入数字页码');
      return;
    }

    const target = Math.min(totalPages, Math.max(1, Number(value)));
    setJumpValue(String(target));
    setJumpError('');
    onPageChange(target);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="ym-pagination-block" aria-label="分页导航">
      <div className="ym-pagination">
        <button
          type="button"
          className="ym-page-button ym-page-direction"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </button>

        <div className="ym-page-numbers">
          {items.map((item) =>
            typeof item === 'string' ? (
              <span className="ym-page-ellipsis" key={item} aria-hidden="true">…</span>
            ) : (
              <button
                type="button"
                key={item}
                className={`ym-page-button ym-page-number${item === currentPage ? ' is-active' : ''}`}
                aria-current={item === currentPage ? 'page' : undefined}
                disabled={item === currentPage}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="ym-page-button ym-page-direction"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </button>

        {showJump && (
          <form className="ym-page-jump" onSubmit={submitJump} noValidate>
            <label htmlFor="ym-page-jump-input">前往</label>
            <input
              id="ym-page-jump-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={jumpValue}
              onChange={(event) => {
                setJumpValue(event.target.value);
                if (jumpError) setJumpError('');
              }}
              aria-invalid={Boolean(jumpError)}
              aria-describedby={jumpError ? 'ym-page-jump-error' : undefined}
            />
            <span>页</span>
            <button type="submit" className="ym-page-confirm" aria-label="确认跳转页码">
              确认
            </button>
            {jumpError && (
              <span className="ym-page-jump-error" id="ym-page-jump-error" role="alert">
                {jumpError}
              </span>
            )}
          </form>
        )}
      </div>

      {typeof totalItems === 'number' && (
        <p className="ym-pagination-summary">
          共 {totalItems} {itemLabel}，第 {currentPage}/{totalPages} 页
        </p>
      )}
    </div>
  );
}

export { buildPagination };
