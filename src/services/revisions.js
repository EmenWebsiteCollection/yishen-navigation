// src/services/revisions.js
// Issue #39 P3：作品成长档案（版本快照，只读）+ 采纳建议
import { supabase } from './supabase.js';

let _supported = null;
export const isRevisionsSupported = async () => {
  if (_supported !== null) return _supported;
  try {
    const { error } = await supabase.from('work_revisions').select('id').limit(1);
    _supported = !error;
  } catch {
    _supported = false;
  }
  return _supported;
};

// 依据当前状态推断版本标签：首版 / 已完成=最终版 / 其余=修改版
const inferVersionLabel = (work, prevNo) => {
  if (!prevNo) return 'first';
  if (work?.status === 'completed') return 'final';
  return 'revised';
};

/**
 * 创建版本快照（服务层在作品更新后自动调用）
 * @param {string} workId
 * @param {object} opts - { note, adoptedCommentIds, adoptedSummary, forceLabel }
 */
export const createRevisionSnapshot = async (workId, opts = {}) => {
  if (!(await isRevisionsSupported())) return null;
  const { note = null, adoptedCommentIds = [], adoptedSummary = null, forceLabel = null } = opts || {};

  const { data: work, error: wErr } = await supabase
    .from('works')
    .select('id, title, description, image_url, cover_url, changelog, status, user_id')
    .eq('id', workId)
    .maybeSingle();
  if (wErr) throw wErr;
  if (!work) throw new Error('作品不存在');

  const { data: prev, error: pErr } = await supabase
    .from('work_revisions')
    .select('revision_no')
    .eq('work_id', workId)
    .order('revision_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pErr && pErr.code !== 'PGRST116') throw pErr;

  const prevNo = prev?.revision_no || 0;
  const versionLabel = forceLabel || inferVersionLabel(work, prevNo);

  const { data, error } = await supabase
    .from('work_revisions')
    .insert({
      work_id: workId,
      revision_no: prevNo + 1,
      version_label: versionLabel,
      title: work.title,
      description: work.description,
      image_url: work.image_url,
      cover_url: work.cover_url,
      changelog: work.changelog,
      note,
      adopted_comment_ids: adoptedCommentIds || [],
      adopted_summary: adoptedSummary,
      created_by: work.user_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getWorkRevisions = async (workId) => {
  if (!workId) return [];
  const { data, error } = await supabase
    .from('work_revisions')
    .select('*')
    .eq('work_id', workId)
    .order('revision_no', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getWorkRevisionCount = async (workId) => {
  if (!workId) return 0;
  const { count, error } = await supabase
    .from('work_revisions')
    .select('*', { count: 'exact', head: true })
    .eq('work_id', workId);
  if (error) return 0;
  return count || 0;
};

/**
 * 标记评论已被作者采纳（仅作品作者可操作）
 * 追加到最新版本的 adopted_comment_ids，形成「采纳建议 → 成长档案」闭环
 */
export const markCommentAdopted = async (commentId, workId, userId, summary = '') => {
  const { data: work, error: wErr } = await supabase
    .from('works')
    .select('user_id')
    .eq('id', workId)
    .maybeSingle();
  if (wErr) throw wErr;
  if (!work) throw new Error('作品不存在');
  if (work.user_id !== userId) throw new Error('只有作品作者可以采纳建议');

  const { error: cErr } = await supabase
    .from('comments')
    .update({ adopted: true })
    .eq('id', commentId);
  if (cErr) throw cErr;

  // 找到最新版本（无则先建一个）
  const { data: latest, error: lErr } = await supabase
    .from('work_revisions')
    .select('id, adopted_comment_ids')
    .eq('work_id', workId)
    .order('revision_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lErr && lErr.code !== 'PGRST116') throw lErr;

  const ids = latest ? (latest.adopted_comment_ids || []) : [];
  if (!ids.includes(commentId)) ids.push(commentId);

  if (latest) {
    const { error } = await supabase
      .from('work_revisions')
      .update({
        adopted_comment_ids: ids,
        adopted_summary: summary?.trim() || latest.adopted_summary,
      })
      .eq('id', latest.id);
    if (error) throw error;
  } else {
    await createRevisionSnapshot(workId, { adoptedCommentIds: ids, adoptedSummary: summary?.trim() || null });
  }
  return { adopted: true };
};
