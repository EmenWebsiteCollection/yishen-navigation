import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function firstEnabledIndex(options) {
  return options.findIndex((option) => !option.disabled);
}

function nextEnabledIndex(options, startIndex, direction) {
  if (!options.length) return -1;
  let index = startIndex;
  for (let count = 0; count < options.length; count += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

/**
 * 轻量、受控的主题选择器。保留原有 onChange(value) 数据流，不依赖原生 option 弹层。
 */
export function ThemeSelect({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  className = '',
  style,
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listboxId = useId();
  const selectedOption = options[selectedIndex];
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideInteraction = (event) => {
      const insideTrigger = rootRef.current?.contains(event.target);
      const insideMenu = menuRef.current?.contains(event.target);
      if (!insideTrigger && !insideMenu) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideInteraction);
    document.addEventListener('focusin', closeOnOutsideInteraction);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction);
      document.removeEventListener('focusin', closeOnOutsideInteraction);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return undefined;
    }

    let frameId = 0;
    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const triggerRect = trigger.getBoundingClientRect();
      const viewportMargin = 8;
      const gap = 6;
      const minimumWidth = className.includes('ym-theme-select--compact') ? 132 : 0;
      const width = Math.min(
        Math.max(triggerRect.width, minimumWidth),
        Math.max(viewportMargin, window.innerWidth - viewportMargin * 2),
      );
      const menuHeight = menu.getBoundingClientRect().height;
      const belowTop = triggerRect.bottom + gap;
      const aboveTop = triggerRect.top - gap - menuHeight;
      const canFlipAbove = aboveTop >= viewportMargin;
      const fitsBelow = belowTop + menuHeight <= window.innerHeight - viewportMargin;
      const top = fitsBelow || !canFlipAbove
        ? Math.min(belowTop, Math.max(viewportMargin, window.innerHeight - viewportMargin - menuHeight))
        : aboveTop;
      const left = Math.min(
        Math.max(viewportMargin, triggerRect.left),
        Math.max(viewportMargin, window.innerWidth - viewportMargin - width),
      );
      const nextPosition = { top, left, width };

      setMenuPosition((previous) => {
        if (
          previous &&
          previous.top === nextPosition.top &&
          previous.left === nextPosition.left &&
          previous.width === nextPosition.width
        ) {
          return previous;
        }
        return nextPosition;
      });
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateMenuPosition);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [className, open, options.length]);

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
    setMenuPosition(null);
    setOpen(true);
  };

  const selectIndex = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    const currentIndex = activeIndex >= 0 ? activeIndex : selectedIndex;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) selectIndex(currentIndex);
      else openMenu();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const fallback = direction === 1 ? -1 : 0;
      setActiveIndex(nextEnabledIndex(options, currentIndex >= 0 ? currentIndex : fallback, direction));
      setMenuPosition(null);
      setOpen(true);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const ordered = event.key === 'Home' ? options : [...options].reverse();
      const enabled = ordered.find((option) => !option.disabled);
      if (enabled) setActiveIndex(options.indexOf(enabled));
      setMenuPosition(null);
      setOpen(true);
    }
  };

  return (
    <div ref={rootRef} className={`ym-theme-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <button
        ref={triggerRef}
        type="button"
        className="ym-theme-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className="ym-theme-select__value">{selectedOption?.label ?? '请选择'}</span>
        <span className="ym-theme-select__chevron" aria-hidden="true">⌄</span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          className={`ym-theme-select__menu${className ? ` ${className}` : ''}`}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            width: menuPosition?.width ?? triggerRef.current?.getBoundingClientRect().width,
            visibility: menuPosition ? 'visible' : 'hidden',
            zIndex: 1100,
          }}
        >
          {options.map((option, index) => (
            <button
              id={`${listboxId}-option-${index}`}
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              disabled={option.disabled}
              className={`ym-theme-select__option${index === activeIndex ? ' is-active' : ''}${index === selectedIndex ? ' is-selected' : ''}`}
              onMouseMove={() => !option.disabled && setActiveIndex(index)}
              onClick={() => selectIndex(index)}
            >
              <span>{option.label}</span>
              {index === selectedIndex && <span className="ym-theme-select__check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
