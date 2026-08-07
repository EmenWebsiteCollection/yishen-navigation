// src/hooks/useDevice.js
// 设备类型检测（Issue #9 需求一：自动检测用户当前设备类型）
// 断点与 responsive.css 保持一致：
//   mobile  <= 640px
//   tablet  641px ~ 1024px
//   desktop > 1024px

import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 640px)';
const TABLET_QUERY = '(min-width: 641px) and (max-width: 1024px)';

export function getDevice() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  if (window.matchMedia(MOBILE_QUERY).matches) return 'mobile';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'desktop';
}

// 同步设备类型到 <html data-device="mobile|tablet|desktop">，
// 供 CSS 选择器（[data-device="mobile"] ...）与组件逻辑使用。
export function syncDeviceAttribute() {
  document.documentElement.setAttribute('data-device', getDevice());
}

/**
 * 响应式设备检测 Hook：
 * - 自动监听窗口尺寸变化（含旋转/分屏），保持 data-device 同步
 * - 返回 { device, isMobile, isTablet, isDesktop }
 * 用法示例：const { isMobile } = useDevice(); if (isMobile) { ... }
 */
export function useDevice() {
  const [device, setDevice] = useState(getDevice);

  useEffect(() => {
    const mqlMobile = window.matchMedia(MOBILE_QUERY);
    const mqlTablet = window.matchMedia(TABLET_QUERY);

    const onChange = () => {
      const d = getDevice();
      setDevice(d);
      syncDeviceAttribute();
    };

    mqlMobile.addEventListener?.('change', onChange);
    mqlTablet.addEventListener?.('change', onChange);
    syncDeviceAttribute();

    return () => {
      mqlMobile.removeEventListener?.('change', onChange);
      mqlTablet.removeEventListener?.('change', onChange);
    };
  }, []);

  return {
    device,
    isMobile: device === 'mobile',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
  };
}
