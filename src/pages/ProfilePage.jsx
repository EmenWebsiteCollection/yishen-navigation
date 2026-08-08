// src/pages/ProfilePage.jsx
// 个人中心：我的作品 / 我的收藏 / 设置（档案 + 分组）
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import {
  getWorksByUser,
  setWorkFeatured,
  setWorkVisibility,
  deleteWork,
  listGroups,
  createGroup,
  renameGroup,
  deleteGroup,
  assignWorkGroup,
  getMyFavoriteWorks,
  unfavoriteWork,
  workTypeLabel,
  workStatusLabel,
} from '../services/works.js';
import { getProfile, updateProfile, getCreatorStats } from '../services/users.js';
import { uploadAvatar, uploadCover, validateImageFile } from '../services/screenshot.js';
import { getPartitions } from '../services/partitions.js';
import '../styles/global.css';

const TABS = [
  { id: 'works', label: '我的作品' },
  { id: 'favorites', label: '我的收藏' },
  { id: 'settings', label: '设置' },
];

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  fontSize: '14px',
  backgroundColor: 'var(--ym-bg-card)',
  color: 'var(--ym-text-primary)',
  boxSizing: 'border-box',
  fontFamily: 'var(--ym-font-body)',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  color: 'var(--ym-text-secondary)',
  marginBottom: '4px',
  fontWeight: '500',
};

export function ProfilePage() {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'settings' ? 'settings' : 'works'));

  // 我的作品
  const [works, setWorks] = useState([]);
  const [worksTotal, setWorksTotal] = useState(0);
  const [worksPage, setWorksPage] = useState(1);
  const [worksLoading, setWorksLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [pageSize] = useState(10);

  // 我的收藏
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // 统计
  const [stats, setStats] = useState({ work_count: 0, like_count: 0, favorite_count: 0, comment_count: 0 });

  // 设置
  const [profile, setProfile] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [groupName, setGroupName] = useState('');

  const me = user && !isAnonymous ? user : null;
  const userId = me?.id;

  const loadWorks = useCallback(async () => {
    if (!userId) return;
    setWorksLoading(true);
    try {
      const { works: list, total } = await getWorksByUser(userId, {
        page: worksPage,
        pageSize,
        currentUserId: userId,
        groupId: selectedGroup === 'all' ? null : selectedGroup,
      });
      setWorks(list);
      setWorksTotal(total);
    } catch (err) {
      console.error('加载我的作品失败:', err);
    } finally {
      setWorksLoading(false);
    }
  }, [userId, worksPage, pageSize, selectedGroup]);

  const loadGroups = useCallback(async () => {
    if (!userId) return;
    try {
      setGroups(await listGroups(userId));
    } catch (err) {
      console.error('加载分组失败:', err);
    }
  }, [userId]);

  const loadFavorites = useCallback(async () => {
    if (!userId) return;
    setFavoritesLoading(true);
    try {
      setFavorites(await getMyFavoriteWorks(userId));
    } catch (err) {
      console.error('加载收藏失败:', err);
    } finally {
      setFavoritesLoading(false);
    }
  }, [userId]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    setStats(await getCreatorStats(userId));
  }, [userId]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setSettingsLoading(true);
    try {
      const p = await getProfile(userId);
      setProfile(p);
      setForm({
        bio: p?.bio || '',
        expertise: (p?.expertise || []).join('，'),
        tools: (p?.tools || []).join('，'),
        style_tags: (p?.style_tags || []).join('，'),
        current_project: p?.current_project || '',
        creation_progress: p?.creation_progress ?? 0,
        collab_status: p?.collab_status || 'open',
        commission_status: p?.commission_status || 'open',
        services: p?.services || '',
        socials: (p?.socials || []).map((s) => `${s.platform || ''},${s.url || ''}`).join('\n'),
        website_link: p?.website_link || '',
        bg_color: p?.bg_color || '',
        accent_color: p?.accent_color || '',
      });
    } catch (err) {
      console.error('加载档案失败:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadWorks();
    loadGroups();
    loadStats();
    loadProfile();
    getPartitions().catch(() => {});
  }, [userId, loadWorks, loadGroups, loadStats, loadProfile]);

  useEffect(() => {
    if (!userId) return;
    if (tab === 'favorites') loadFavorites();
  }, [tab, userId, loadFavorites, loadProfile]);

  // ---------- 作品操作 ----------
  const handleToggleFeatured = async (work) => {
    try {
      await setWorkFeatured(work.id, !work.featured);
      setWorks((prev) => prev.map((w) => (w.id === work.id ? { ...w, featured: !w.featured } : w)));
    } catch (err) {
      alert(err.message || '操作失败');
    }
  };

  const handleToggleVisibility = async (work) => {
    try {
      const next = work.visibility === 'private' ? 'public' : 'private';
      await setWorkVisibility(work.id, next);
      setWorks((prev) => prev.map((w) => (w.id === work.id ? { ...w, visibility: next } : w)));
    } catch (err) {
      alert(err.message || '操作失败');
    }
  };

  const handleDeleteWork = async (work) => {
    if (!window.confirm(`确认删除作品「${work.title}」吗？此操作不可撤销。`)) return;
    try {
      await deleteWork(work.id);
      setWorks((prev) => prev.filter((w) => w.id !== work.id));
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  const handleAssignGroup = async (workId, groupId) => {
    try {
      await assignWorkGroup(workId, groupId === 'none' ? null : groupId);
      setWorks((prev) =>
        prev.map((w) => (w.id === workId ? { ...w, group_id: groupId === 'none' ? null : groupId } : w))
      );
    } catch (err) {
      alert(err.message || '操作失败');
    }
  };

  const handleUnfavorite = async (fav) => {
    try {
      await unfavoriteWork(fav.work.id, userId);
      setFavorites((prev) => prev.filter((f) => f.favorite_id !== fav.favorite_id));
    } catch (err) {
      alert(err.message || '取消收藏失败');
    }
  };

  // ---------- 分组管理 ----------
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const g = await createGroup(userId, groupName);
      setGroups((prev) => [...prev, g]);
      setGroupName('');
    } catch (err) {
      alert(err.message || '创建分组失败');
    }
  };

  const handleRenameGroup = async (g) => {
    const name = window.prompt('输入新的分组名', g.name);
    if (!name || name.trim() === g.name) return;
    try {
      await renameGroup(g.id, name.trim());
      setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, name: name.trim() } : x)));
    } catch (err) {
      alert(err.message || '重命名失败');
    }
  };

  const handleDeleteGroup = async (g) => {
    if (!window.confirm(`确认删除分组「${g.name}」吗？组内作品将变为未分组。`)) return;
    try {
      await deleteGroup(g.id);
      setGroups((prev) => prev.filter((x) => x.id !== g.id));
    } catch (err) {
      alert(err.message || '删除分组失败');
    }
  };

  // ---------- 档案保存 ----------
  const parseSocials = (text) =>
    (text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(',');
        if (idx === -1) return { platform: '链接', url: line };
        return { platform: line.slice(0, idx).trim() || '链接', url: line.slice(idx + 1).trim() };
      })
      .filter((s) => s.url);

  const splitTags = (text) =>
    (text || '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      let avatarUrl = profile?.avatar_url || null;
      let coverUrl = profile?.cover_url || null;
      if (avatarFile) avatarUrl = await uploadAvatar(avatarFile, userId);
      if (coverFile) coverUrl = await uploadCover(coverFile, userId);

      await updateProfile(userId, {
        bio: form.bio?.trim() || null,
        expertise: splitTags(form.expertise),
        tools: splitTags(form.tools),
        style_tags: splitTags(form.style_tags),
        current_project: form.current_project?.trim() || null,
        creation_progress: Math.max(0, Math.min(100, Number(form.creation_progress) || 0)),
        collab_status: form.collab_status || 'open',
        commission_status: form.commission_status || 'open',
        services: form.services?.trim() || null,
        socials: parseSocials(form.socials),
        website_link: form.website_link?.trim() || null,
        bg_color: form.bg_color?.trim() || null,
        accent_color: form.accent_color?.trim() || null,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        ...(coverUrl ? { cover_url: coverUrl } : {}),
      });
      setSaveMsg('✅ 已保存');
      setAvatarFile(null);
      setCoverFile(null);
      await loadProfile();
      window.dispatchEvent(new CustomEvent('ym-profile-updated'));
    } catch (err) {
      setSaveMsg(`❌ 保存失败：${err.message || '请稍后重试'}`);
    } finally {
      setSaving(false);
    }
  };

  // ---------- 渲染 ----------
  if (authLoading) {
    return <div style={{ textAlign: 'center', marginTop: '200px', color: 'var(--ym-text-secondary)' }}>加载中...</div>;
  }

  if (!me) {
    return (
      <div style={{ maxWidth: '420px', margin: '80px auto', padding: '32px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: 'var(--ym-text-primary)', marginBottom: '8px' }}>请先登录</div>
        <div style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', marginBottom: '16px' }}>登录后即可进入个人中心</div>
        <Link to="/" style={{ color: 'var(--ym-accent)', textDecoration: 'none', fontSize: '14px' }}>← 返回首页登录</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="ym-space-cover">
        {profile?.cover_url ? (
          <img src={profile.cover_url} alt="封面" decoding="async" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ym-text-muted)', fontSize: '14px' }}>
            个人中心
          </div>
        )}
      </div>

      <div className="ym-space-body">
        <div className="ym-space-head">
          <div className="ym-space-avatar">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="头像" decoding="async" />
            ) : (
              <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '34px' }}>👤</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: '220px', paddingBottom: '4px' }}>
            <h1 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '24px', fontWeight: '600', color: 'var(--ym-text-primary)', margin: 0 }}>
              {me?.email?.replace('@nav.local', '') || '我的主页'}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>
              {profile?.bio || '管理你的作品、收藏与创作者资料'}
            </p>
          </div>
          <Link to="/create" className="ym-btn ym-btn-primary">+ 新建作品</Link>
        </div>

        {/* 统计卡 */}
        <div className="ym-stats">
          {[
            { label: '公开作品', value: stats.work_count },
            { label: '累计获赞', value: stats.like_count },
            { label: '被收藏', value: stats.favorite_count },
            { label: '作品评论', value: stats.comment_count },
          ].map((s) => (
            <div key={s.label} className="ym-stat">
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tab 切换 */}
        <div className="ym-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={'ym-tab' + (tab === t.id ? ' active' : '')}
              role="tab"
              aria-selected={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab1 我的作品 */}
        {tab === 'works' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button
                onClick={() => { setSelectedGroup('all'); setWorksPage(1); }}
                style={chipStyle(selectedGroup === 'all')}
              >
                全部
              </button>
              <button
                onClick={() => { setSelectedGroup('none'); setWorksPage(1); }}
                style={chipStyle(selectedGroup === 'none')}
              >
                未分组
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGroup(g.id); setWorksPage(1); }}
                  style={chipStyle(selectedGroup === g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>

            {worksLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-muted)' }}>加载中...</div>
            ) : works.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-secondary)' }}>暂无作品，点击右上角新建</div>
            ) : (
              works.map((w) => (
                <div key={w.id} style={{ display: 'flex', gap: '14px', padding: '14px 16px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ width: '88px', height: '56px', borderRadius: 'var(--ym-radius-sm)', overflow: 'hidden', backgroundColor: 'var(--ym-bg-subtle)', flexShrink: 0 }}>
                    {w.image_url ? (
                      <img src={w.image_url} alt={w.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--ym-text-muted)' }}>
                        {workTypeLabel(w.work_type)}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Link to={`/website/${w.id}`} style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)', textDecoration: 'none' }}>
                        {w.title}
                      </Link>
                      {w.featured && <span style={badgeStyle('var(--ym-success)')}>精选</span>}
                      {w.visibility === 'private' && <span style={badgeStyle('var(--ym-text-muted)')}>私密</span>}
                      {w.status && <span style={badgeStyle('var(--ym-accent)')}>{workStatusLabel(w.status)}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
                      {workTypeLabel(w.work_type)} · ❤️ {w.like_count} · {new Date(w.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={w.group_id || 'none'}
                      onChange={(e) => handleAssignGroup(w.id, e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', backgroundColor: 'var(--ym-bg-card)', color: 'var(--ym-text-secondary)' }}
                    >
                      <option value="none">未分组</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button onClick={() => handleToggleFeatured(w)} style={smallBtnStyle}>
                      {w.featured ? '取消精选' : '设精选'}
                    </button>
                    <button onClick={() => handleToggleVisibility(w)} style={smallBtnStyle}>
                      {w.visibility === 'private' ? '设为公开' : '设为私密'}
                    </button>
                    <Link to={`/website/${w.id}/edit`} style={{ ...smallBtnStyle, textDecoration: 'none', display: 'inline-block' }}>编辑</Link>
                    <button onClick={() => handleDeleteWork(w)} style={{ ...smallBtnStyle, color: 'var(--ym-danger)', borderColor: 'var(--ym-danger)' }}>删除</button>
                  </div>
                </div>
              ))
            )}

            {worksTotal > pageSize && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                <button
                  disabled={worksPage <= 1}
                  onClick={() => setWorksPage((p) => p - 1)}
                  style={pageBtnStyle(worksPage <= 1)}
                >
                  上一页
                </button>
                <span style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', alignSelf: 'center' }}>
                  {worksPage}/{Math.ceil(worksTotal / pageSize) || 1}
                </span>
                <button
                  disabled={worksPage >= Math.ceil(worksTotal / pageSize)}
                  onClick={() => setWorksPage((p) => p + 1)}
                  style={pageBtnStyle(worksPage >= Math.ceil(worksTotal / pageSize))}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab2 我的收藏 */}
        {tab === 'favorites' && (
          <div>
            {favoritesLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-muted)' }}>加载中...</div>
            ) : favorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-secondary)' }}>还没有收藏，去详情页点「收藏」吧</div>
            ) : (
              favorites.map((fav) => (
                <div key={fav.favorite_id} style={{ display: 'flex', gap: '14px', padding: '12px 16px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link to={`/website/${fav.work.id}`} style={{ fontSize: '15px', color: 'var(--ym-text-primary)', textDecoration: 'none', flex: 1, minWidth: '160px' }}>
                    {fav.work.title}
                    <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginLeft: '8px' }}>{workTypeLabel(fav.work.work_type)}</span>
                  </Link>
                  <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>❤️ {fav.work.like_count}</span>
                  <button onClick={() => handleUnfavorite(fav)} style={{ ...smallBtnStyle, color: 'var(--ym-danger)', borderColor: 'var(--ym-danger)' }}>取消收藏</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab3 设置 */}
        {tab === 'settings' && (
          <div>
            {settingsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-muted)' }}>加载中...</div>
            ) : (
              <form onSubmit={handleSaveSettings} style={{ backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)', padding: '24px' }}>
                <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', marginBottom: '16px' }}>基本资料</h3>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>头像</label>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--ym-bg-subtle)', border: '1px solid var(--ym-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
                      {avatarFile ? (
                        <img src={URL.createObjectURL(avatarFile)} alt="头像预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="头像" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : '无头像'}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; const err = f ? validateImageFile(f) : null; if (err) { alert(err); e.target.value = ''; return; } setAvatarFile(f); }} style={{ fontSize: '12px', marginTop: '6px' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label style={labelStyle}>主页封面（可选，建议 1280×360）</label>
                    <div style={{ height: '90px', borderRadius: 'var(--ym-radius-sm)', overflow: 'hidden', backgroundColor: 'var(--ym-bg-subtle)', border: '1px dashed var(--ym-border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--ym-text-muted)', marginBottom: '6px' }}>
                      {coverFile ? (
                        <img src={URL.createObjectURL(coverFile)} alt="封面预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : profile?.cover_url ? (
                        <img src={profile.cover_url} alt="封面" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : '上传封面'}
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; const err = f ? validateImageFile(f) : null; if (err) { alert(err); e.target.value = ''; return; } setCoverFile(f); }} style={{ fontSize: '12px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>个人介绍</label>
                  <textarea value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows="3" style={inputStyle} placeholder="介绍一下自己..." />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>擅长领域（逗号分隔）</label>
                    <input value={form.expertise || ''} onChange={(e) => setForm({ ...form, expertise: e.target.value })} style={inputStyle} placeholder="插画, 写作" />
                  </div>
                  <div>
                    <label style={labelStyle}>常用工具（逗号分隔）</label>
                    <input value={form.tools || ''} onChange={(e) => setForm({ ...form, tools: e.target.value })} style={inputStyle} placeholder="Photoshop, Procreate" />
                  </div>
                  <div>
                    <label style={labelStyle}>创作风格标签（逗号分隔）</label>
                    <input value={form.style_tags || ''} onChange={(e) => setForm({ ...form, style_tags: e.target.value })} style={inputStyle} placeholder="赛博朋克, 治愈系" />
                  </div>
                </div>

                <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', margin: '20px 0 16px' }}>当前项目与合作</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>当前项目</label>
                    <input value={form.current_project || ''} onChange={(e) => setForm({ ...form, current_project: e.target.value })} style={inputStyle} placeholder="正在创作的作品名" />
                  </div>
                  <div>
                    <label style={labelStyle}>创作进度：{Number(form.creation_progress) || 0}%</label>
                    <input type="range" min="0" max="100" value={Number(form.creation_progress) || 0} onChange={(e) => setForm({ ...form, creation_progress: e.target.value })} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>合作状态</label>
                    <select value={form.collab_status || 'open'} onChange={(e) => setForm({ ...form, collab_status: e.target.value })} style={inputStyle}>
                      <option value="open">开放合作</option>
                      <option value="limited">有限合作</option>
                      <option value="closed">暂不合作</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>商业委托</label>
                    <select value={form.commission_status || 'open'} onChange={(e) => setForm({ ...form, commission_status: e.target.value })} style={inputStyle}>
                      <option value="open">接受委托</option>
                      <option value="closed">暂不接受</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>可提供的服务</label>
                  <textarea value={form.services || ''} onChange={(e) => setForm({ ...form, services: e.target.value })} rows="2" style={inputStyle} placeholder="如：插画约稿、封面设计、文案代写" />
                </div>

                <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', margin: '20px 0 16px' }}>外链与装扮</h3>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>社交平台（每行：平台,链接）</label>
                  <textarea value={form.socials || ''} onChange={(e) => setForm({ ...form, socials: e.target.value })} rows="3" style={inputStyle} placeholder={'微博,https://weibo.com/xxx\n小红书,https://xhslink.com/xxx'} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>个人网站 / 商店链接</label>
                  <input value={form.website_link || ''} onChange={(e) => setForm({ ...form, website_link: e.target.value })} style={inputStyle} placeholder="https://..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  <div>
                    <label style={labelStyle}>主页背景色</label>
                    <input type="color" value={form.bg_color || '#F3EAD8'} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} style={{ width: '100%', height: '38px', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', padding: '2px' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>主页强调色</label>
                    <input type="color" value={form.accent_color || '#9C6B2E'} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} style={{ width: '100%', height: '38px', border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', padding: '2px' }} />
                  </div>
                </div>

                {saveMsg && (
                  <div style={{ padding: '10px 14px', marginBottom: '14px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: saveMsg.startsWith('✅') ? 'var(--ym-success-bg)' : 'var(--ym-danger-bg)', color: saveMsg.startsWith('✅') ? 'var(--ym-success)' : 'var(--ym-danger)', fontSize: '14px' }}>
                    {saveMsg}
                  </div>
                )}

                <button type="submit" disabled={saving} style={{ padding: '10px 32px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', fontSize: '15px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '保存中...' : '保存档案'}
                </button>

                <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', margin: '28px 0 16px' }}>分组管理</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="新分组名" style={{ ...inputStyle, width: '200px' }} />
                  <button type="button" onClick={handleCreateGroup} style={{ padding: '8px 18px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', cursor: 'pointer' }}>创建分组</button>
                </div>
                {groups.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>还没有分组</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {groups.map((g) => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-sm)' }}>
                        <span style={{ flex: 1, fontSize: '14px', color: 'var(--ym-text-primary)' }}>{g.name}</span>
                        <button type="button" onClick={() => handleRenameGroup(g)} style={smallBtnStyle}>重命名</button>
                        <button type="button" onClick={() => handleDeleteGroup(g)} style={{ ...smallBtnStyle, color: 'var(--ym-danger)', borderColor: 'var(--ym-danger)' }}>删除</button>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 内联样式工具 ----------
const chipStyle = (active) => ({
  padding: '6px 14px',
  borderRadius: '20px',
  border: '1px solid var(--ym-border)',
  backgroundColor: active ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
  color: active ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
  cursor: 'pointer',
  fontSize: '13px',
  transition: 'all var(--ym-transition)',
});

const smallBtnStyle = {
  padding: '5px 12px',
  fontSize: '12px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  backgroundColor: 'var(--ym-bg-card)',
  color: 'var(--ym-text-secondary)',
  cursor: 'pointer',
  transition: 'all var(--ym-transition)',
};

const pageBtnStyle = (disabled) => ({
  padding: '6px 16px',
  fontSize: '13px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  backgroundColor: 'var(--ym-bg-card)',
  color: disabled ? 'var(--ym-text-muted)' : 'var(--ym-text-secondary)',
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const badgeStyle = (color) => ({
  fontSize: '11px',
  color: '#fff',
  backgroundColor: color,
  padding: '2px 8px',
  borderRadius: '10px',
});
