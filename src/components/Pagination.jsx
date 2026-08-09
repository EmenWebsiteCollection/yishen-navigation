import React, { useEffect, useMemo, useRef, useState } from 'react';

// 每页数量的预设值与上限（与 services/works.js 中 getWorks 的钳制保持一致）
export const PAGE_SIZE_PRESETS = [10, 20, 50];
export const PAGE_SIZE_MAX = 50;

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
  pageSize,
  onPageSizeChange,
}) {
  const [jumpValue, setJumpValue] = useState(String(currentPage));
  const [jumpError, setJumpError] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [sizeError, setSizeError] = useState('');
  const [customActive, setCustomActive] = useState(() => !PAGE_SIZE_PRESETS.includes(pageSize));
  const customInputRef = useRef(null);
  const items = useMemo(
    () => buildPagination(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const isPreset = PAGE_SIZE_PRESETS.includes(pageSize);

  useEffect(() => {
    setJumpValue(String(currentPage));
    setJumpError('');
  }, [currentPage]);

  // 每页数量变化时同步自定义输入框的显示与内容
  useEffect(() => {
    if (isPreset) {
      setCustomActive(false);
    } else {
      setCustomActive(true);
      setCustomSize(String(pageSize));
    }
    setSizeError('');
  }, [pageSize, isPreset]);

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

  const handlePageSizeChange = (value) => {
    if (value && onPageSizeChange) {
      onPageSizeChange(value);
      // 切换每页数量后回到第 1 页
    }
  };

  const handlePageSizeSelect = (event) => {
    const value = event.target.value;
    if (value === 'custom') {
      setSizeError('');
      setCustomActive(true);
      setCustomSize(isPreset ? '' : String(pageSize));
      window.requestAnimationFrame(() => customInputRef.current?.focus());
      return;
    }
    setCustomActive(false);
    handlePageSizeChange(Number(value));
  };

  const submitCustomSize = (event) => {
    event.preventDefault();
    const raw = customSize.trim();

    if (!/^\d+$/.test(raw)) {
      setSizeError('请输入数字');
      return;
    }

    const value = Number(raw);
    if (value < 1 || value > PAGE_SIZE_MAX) {
      setSizeError(`请输入 1-${PAGE_SIZE_MAX} 的数字`);
      return;
    }

    setSizeError('');
    if (value !== pageSize) handlePageSizeChange(value);
  };

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
        <div className="ym-pagination-summary-row">
          <p className="ym-pagination-summary">
            共 {totalItems} {itemLabel}，第 {currentPage}/{totalPages} 页
          </p>
          {pageSize && onPageSizeChange && (
            <div className="ym-pagination-size" role="group" aria-label="每页显示数量">
              <span>每页</span>
              <select value={customActive ? 'custom' : pageSize} onChange={handlePageSizeSelect}>
                {PAGE_SIZE_PRESETS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
                <option value="custom">自定义</option>
              </select>
              {customActive && (
                <form className="ym-pagination-custom-size" onSubmit={submitCustomSize} noValidate>
                  <input
                    ref={customInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={customSize}
                    onChange={(event) => {
                      setCustomSize(event.target.value);
                      if (sizeError) setSizeError('');
                    }}
                    aria-invalid={Boolean(sizeError)}
                    aria-label="自定义每页数量"
                  />
                  <button type="submit" className="ym-page-confirm">确定</button>
                </form>
              )}
              <span>个</span>
              {sizeError && (
                <span className="ym-page-jump-error" role="alert">{sizeError}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { buildPagination };
