// 分区服务：首页分区 tab 的可配置列表。
// 分区表未迁移时自动降级为默认分区，保证页面仍可用。
import { supabase } from './supabase.js';
import { isAdmin } from './works.js';
import { isDataProxyEnabled, dataProxyFetch } from './dataProxy.js';

export const DEFAULT_PARTITIONS = [
  { id: 'website', name: '网站', work_type: 'website', sort_order: 10 },
  { id: 'novel', name: '小说', work_type: 'novel', sort_order: 20 },
  { id: 'illustration', name: '插画', work_type: 'illustration', sort_order: 30 },
  { id: 'game', name: '游戏', work_type: 'game', sort_order: 40 },
  { id: 'music', name: '音乐', work_type: 'music', sort_order: 50 },
  { id: 'video', name: '视频', work_type: 'video', sort_order: 60 },
  { id: 'photo', name: '摄影', work_type: 'photo', sort_order: 70 },
  { id: 'other', name: '其他', work_type: 'other', sort_order: 80 },
];

let partitionLabelMap = {};

const syncLabels = (partitions) => {
  partitionLabelMap = (partitions || []).reduce((acc, p) => {
    if (p?.work_type) acc[p.work_type] = p.name;
    return acc;
  }, {});
};

export const getPartitionLabel = (workType) => partitionLabelMap[workType] || '';

export const getPartitions = async () => {
  // issue #127：公开读分区列表走函数缓存中转，失败回退直连
  if (isDataProxyEnabled()) {
    try {
      const body = await dataProxyFetch('partitions');
      const list = body.data && body.data.length ? body.data : DEFAULT_PARTITIONS;
      syncLabels(list);
      return list;
    } catch (e) {
      console.warn('⚠️ 数据中转(partitions)失败，回退直连:', e.message);
    }
  }
  try {
    const { data, error } = await supabase
      .from('partitions')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const list = data && data.length ? data : DEFAULT_PARTITIONS;
    syncLabels(list);
    return list;
  } catch (err) {
    console.warn('分区表读取失败，使用默认分区:', err.message);
    syncLabels(DEFAULT_PARTITIONS);
    return DEFAULT_PARTITIONS;
  }
};

export const createPartition = async ({ name, workType }, userId) => {
  const trimmedName = (name || '').trim();
  const trimmedType = (workType || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!trimmedName) throw new Error('分区名称不能为空');
  if (trimmedName.length > 20) throw new Error('分区名称不能超过 20 字');
  if (!trimmedType) throw new Error('类型标识不能为空');
  if (trimmedType.length > 30) throw new Error('类型标识不能超过 30 字符');

  const { data, error } = await supabase
    .from('partitions')
    .insert({ name: trimmedName, work_type: trimmedType, created_by: userId })
    .select()
    .single();
  if (error) {
    if (error.code === '42P01' || /relation "public\.partitions" does not exist/.test(error.message || '')) {
      throw new Error('分区表未初始化，请先在 Supabase 执行 sql/002_partitions.sql');
    }
    if (error.code === '23505') throw new Error('分区名称或类型标识已存在');
    throw error;
  }
  syncLabels(await getPartitions());
  return data;
};

export const deletePartition = async (id, userId) => {
  if (!userId) throw new Error('缺少用户信息，无权删除该分区');
  // 删除前校验所有权：仅分区创建者本人或管理员可删（RLS 之外的前端显式校验）
  const { data, error } = await supabase
    .from('partitions')
    .select('id, created_by')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data.created_by !== userId && !(await isAdmin(userId)))) {
    throw new Error('无权删除该分区');
  }
  const { error: delErr } = await supabase.from('partitions').delete().eq('id', id);
  if (delErr) throw delErr;
  syncLabels(await getPartitions());
};
