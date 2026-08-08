// src/services/media.js
// Issue #39 P2：作品媒体（视频/音频）直链上传到 work_media 桶
import { supabase } from './supabase.js';

export const MEDIA_RULES = [
  { mime: 'video/mp4', ext: '.mp4', kind: 'video', maxBytes: 100 * 1024 * 1024 },
  { mime: 'video/webm', ext: '.webm', kind: 'video', maxBytes: 100 * 1024 * 1024 },
  { mime: 'audio/mpeg', ext: '.mp3', kind: 'audio', maxBytes: 30 * 1024 * 1024 },
  { mime: 'audio/ogg', ext: '.ogg', kind: 'audio', maxBytes: 30 * 1024 * 1024 },
];

export const validateMediaFile = (file) => {
  if (!file) throw new Error('未选择文件');
  const rule = MEDIA_RULES.find((r) => r.mime === file.type);
  if (!rule) throw new Error('仅支持 mp4/webm/mp3/ogg 格式');
  if (file.size > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / 1024 / 1024);
    throw new Error(`${rule.kind === 'video' ? '视频' : '音频'}不能超过 ${maxMb}MB`);
  }
  return rule;
};

// 上传并返回公开 URL，随后写回 works.media_url
export const uploadWorkMedia = async (file, workId, userId) => {
  if (!file || !workId || !userId) throw new Error('缺少上传参数');
  const rule = validateMediaFile(file);
  const path = `${userId}/${workId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
  const { error: upErr } = await supabase.storage
    .from('work_media')
    .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from('work_media').getPublicUrl(path);
  const url = pub?.publicUrl;
  if (!url) throw new Error('获取媒体链接失败');

  const { error: metaErr } = await supabase
    .from('works')
    .update({ media_url: url })
    .eq('id', workId);
  if (metaErr) throw metaErr;

  return { url, kind: rule.kind };
};
