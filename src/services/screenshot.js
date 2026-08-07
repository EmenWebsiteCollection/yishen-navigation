// src/services/screenshot.js
import { supabase } from './supabase.js';

// 自动截图接口（Microlink 免费接口，无需 API Key，支持 CORS）
const SCREENSHOT_API_URL =
  import.meta.env.VITE_SCREENSHOT_API_URL || 'https://api.microlink.io/';

// 用户上传图片的存储桶（需在 Supabase 后台创建）
const SCREENSHOT_BUCKET = 'screenshots';

// 默认占位图（当截图失败时使用）
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"%3E%3Crect width="1280" height="720" fill="%23EDE3CC"/%3E%3Ctext x="640" y="360" font-family="Arial" font-size="36" fill="%239C6B2E" text-anchor="middle" dominant-baseline="central"%3E🌐 网站预览%3C/text%3E%3C/svg%3E';

// 自动加载目标网站并截图（返回 16:9 比例的缩略图），失败返回占位图
export const fetchWebsiteScreenshot = async (url, retries = 2) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 使用 'load' 配合 delay，避免 'network_idle1' 超时
      const params = new URLSearchParams({
        url,
        screenshot: 'true',
        fullPage: 'false',
        waitUntil: 'load',           // 回到 'load'，更稳定
        delay: '2000',               // 加载完成后额外等待 2 秒，确保异步内容渲染
        force: 'true',
        viewport: '1280x720',
        width: '1280',
        height: '720',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);
      const res = await fetch(`${SCREENSHOT_API_URL}?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`截图请求失败 (尝试 ${attempt + 1}/${retries}): HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      if (json.status === 'success' && json.data?.screenshot?.url) {
        return json.data.screenshot.url;
      } else {
        console.warn(`截图 API 返回异常 (尝试 ${attempt + 1}/${retries}):`, json);
        continue;
      }
    } catch (err) {
      console.warn(`自动截图失败 (尝试 ${attempt + 1}/${retries}):`, err.message);
    }

    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // 所有重试失败，返回占位图
  console.warn('截图全部失败，使用占位图');
  return PLACEHOLDER_IMAGE;
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