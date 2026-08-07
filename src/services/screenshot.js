// src/services/screenshot.js
import { supabase } from './supabase.js';

// 自动截图接口（Microlink 免费接口，无需 API Key，支持 CORS）
const SCREENSHOT_API_URL =
  import.meta.env.VITE_SCREENSHOT_API_URL || 'https://api.microlink.io/';

// 用户上传图片的存储桶（需在 Supabase 后台创建）
const SCREENSHOT_BUCKET = 'screenshots';

// 自动加载目标网站完整页面并截图，返回图片 URL；失败返回 null
export const fetchWebsiteScreenshot = async (url) => {
  try {
    const params = new URLSearchParams({
      url,
      screenshot: 'true',
      fullPage: 'true',
      waitUntil: 'network_idle',
      force: 'true',
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${SCREENSHOT_API_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 'success' || !json.data?.screenshot?.url) return null;
    return json.data.screenshot.url;
  } catch (err) {
    console.warn('自动截图失败:', err.message);
    return null;
  }
};

// 上传图片到 Supabase Storage，返回公开访问 URL
export const uploadWebsiteImage = async (file, userId) => {
  if (!file) return null;
  const safeName = (file.name || 'image').replace(/[^a-zA-Z0-9.\-]/g, '_');
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: pubData } = supabase.storage
    .from(SCREENSHOT_BUCKET)
    .getPublicUrl(data.path);
  return pubData.publicUrl;
};

// 校验用户选择的图片文件
export const validateImageFile = (file) => {
  if (!file) return null;
  if (!file.type.startsWith('image/')) return '请选择图片文件（PNG/JPG/GIF/WebP 等）';
  if (file.size > 5 * 1024 * 1024) return '图片不能超过 5MB';
  return null;
};
