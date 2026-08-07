// src/services/screenshot.js
import { supabase } from './supabase.js';

// 自动截图接口（Microlink 免费接口，无需 API Key，支持 CORS）
const SCREENSHOT_API_URL =
  import.meta.env.VITE_SCREENSHOT_API_URL || 'https://api.microlink.io/';

// 存储桶
const SCREENSHOT_BUCKET = 'screenshots';
const AVATAR_BUCKET = 'avatars';
const COVER_BUCKET = 'covers';

// 默认占位图（当截图失败时使用）
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"%3E%3Crect width="1280" height="720" fill="%23EDE3CC"/%3E%3Ctext x="640" y="360" font-family="Arial" font-size="36" fill="%239C6B2E" text-anchor="middle" dominant-baseline="central"%3E🌐 网站预览%3C/text%3E%3C/svg%3E';

/**
 * 自动加载目标网站并截图（返回 16:9 比例的缩略图）
 * @param {string} url - 目标网站 URL
 * @param {string} userId - 用户 ID（用于转存到 Storage）
 * @param {number} retries - 重试次数
 * @returns {Promise<string>} 图片 URL（永久链接或占位图）
 */
export const fetchWebsiteScreenshot = async (url, userId = null, retries = 2) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 使用 'load' + delay，稳定且快速
      const params = new URLSearchParams({
        url,
        screenshot: 'true',
        fullPage: 'false',
        waitUntil: 'load',
        delay: '2000',
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
      if (json.status !== 'success' || !json.data?.screenshot?.url) {
        console.warn(`截图 API 返回异常 (尝试 ${attempt + 1}/${retries})`);
        continue;
      }

      const tempUrl = json.data.screenshot.url;

      // 如果有 userId，将截图转存到 Supabase Storage（避免临时链接过期）
      if (userId) {
        try {
          const uploadedUrl = await downloadAndUploadScreenshot(tempUrl, userId);
          if (uploadedUrl) {
            return uploadedUrl;
          }
          console.warn('截图转存失败，退回临时链接');
        } catch (err) {
          console.warn('截图转存异常，退回临时链接:', err.message);
        }
      }

      // 无 userId 或转存失败，返回原始临时链接（可能几天后失效）
      return tempUrl;
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

/**
 * 下载临时截图并上传到 Supabase Storage
 * @param {string} imageUrl - 临时图片 URL
 * @param {string} userId - 用户 ID
 * @returns {Promise<string|null>} 永久图片 URL 或 null
 */
const downloadAndUploadScreenshot = async (imageUrl, userId) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('下载截图失败:', res.status);
      return null;
    }

    const blob = await res.blob();
    // 检查是否为有效图片
    if (!blob.type.startsWith('image/')) {
      console.warn('下载的内容不是图片:', blob.type);
      return null;
    }

    const file = new File([blob], `screenshot-${Date.now()}.png`, {
      type: blob.type || 'image/png',
    });

    // 上传到 Supabase Storage
    const uploadedUrl = await uploadWebsiteImage(file, userId);
    return uploadedUrl;
  } catch (err) {
    console.warn('下载并转存截图失败:', err.message);
    return null;
  }
};

/**
 * 读取图片为位图（优先 createImageBitmap，兼容回退到 <img> 解码）
 */
const loadBitmap = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {
      try {
        return await createImageBitmap(file);
      } catch (_) {
        // 继续走 <img> 回退
      }
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解码失败')); };
    img.src = url;
  });
};

/**
 * 压缩图片：等比缩小超限大图 + 统一转 WebP 减重（保留透明度）
 * - 压缩后若没有更小，返回原文件；动图（GIF）与无法解码的图片直接返回原文件
 * @param {File} file - 原图片文件
 * @param {Object} [opts] - { maxWidth, maxHeight, quality }
 * @returns {Promise<File>} 压缩后的文件（失败/无效时返回原文件）
 */
export const compressImageFile = async (
  file,
  { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = {}
) => {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // 动图不压缩，避免丢帧
  try {
    const bitmap = await loadBitmap(file);
    try {
      const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.size >= file.size) return file; // 不支持 WebP 或压缩无效
      const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
      return new File([blob], `${baseName}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  } catch (err) {
    console.warn('图片压缩失败，使用原图:', err.message);
    return file;
  }
};

/**
 * 通用上传：压缩后把图片上传到指定存储桶，返回公开访问 URL
 * @param {File} file - 图片文件
 * @param {string} userId - 用户 ID
 * @param {string} bucket - 存储桶名（screenshots / avatars / covers）
 * @param {Object} [opts] - 自定义压缩参数（覆盖桶默认档位）
 * @returns {Promise<string>} 公开访问 URL
 */
export const uploadToBucket = async (file, userId, bucket, opts = null) => {
  if (!file) return null;
  // 不同用途给不同压缩档位：截图保持 1280、封面 1600、头像 512
  const BUCKET_PRESETS = {
    screenshots: { maxWidth: 1280, maxHeight: 1280, quality: 0.8 },
    covers: { maxWidth: 1600, maxHeight: 1600, quality: 0.82 },
    avatars: { maxWidth: 512, maxHeight: 512, quality: 0.85 },
  };
  const preset = BUCKET_PRESETS[bucket] || { maxWidth: 1600, maxHeight: 1600, quality: 0.82 };
  const compressed = await compressImageFile(file, opts || preset);
  const safeName = (compressed.name || 'image').replace(/[^a-zA-Z0-9.\-]/g, '_');
  const path = `${userId}/${Date.now()}-${safeName}`;
  // 路径含 userId + 时间戳，图片不可变，可长缓存（1 年）
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, compressed, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data: pubData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);
  return pubData.publicUrl;
};

/**
 * 上传图片到 Supabase Storage（screenshots 桶），返回公开访问 URL
 * @param {File} file - 图片文件
 * @param {string} userId - 用户 ID
 * @returns {Promise<string>} 公开访问 URL
 */
export const uploadWebsiteImage = async (file, userId) =>
  uploadToBucket(file, userId, SCREENSHOT_BUCKET);

/**
 * 上传头像（avatars 桶）
 */
export const uploadAvatar = async (file, userId) =>
  uploadToBucket(file, userId, AVATAR_BUCKET);

/**
 * 上传封面（covers 桶）
 */
export const uploadCover = async (file, userId) =>
  uploadToBucket(file, userId, COVER_BUCKET);

/**
 * 校验用户选择的图片文件
 * @param {File} file - 待校验的文件
 * @returns {string|null} 错误信息或 null
 */
export const validateImageFile = (file) => {
  if (!file) return null;
  if (!file.type.startsWith('image/')) return '请选择图片文件（PNG/JPG/GIF/WebP 等）';
  if (file.size > 5 * 1024 * 1024) return '图片不能超过 5MB';
  return null;
};
