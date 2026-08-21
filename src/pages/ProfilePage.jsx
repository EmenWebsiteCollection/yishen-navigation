// src/pages/ProfilePage.jsx
// 个人中心：我的作品 / 我的收藏 / 设置（档案 + 分组）
import React, { useEffect, useState, useCallback, useRef } from 'react';

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
  isAdmin,
} from '../services/works.js';
import { getProfile, updateProfile, getCreatorStats, bindContact } from '../services/users.js';
import { getCommenterReputation, reputationScore, reputationBadge } from '../services/commentFeedback.js';
import { uploadAvatar, uploadCover, validateImageFile } from '../services/screenshot.js';
import { getMyIdeas, getMyFavoritedIdeas } from '../services/ideas.js';
import { getMyMemory, clearMyMemory } from '../services/yiliMemory.js';
import { IdeaStatusBadge } from '../components/IdeaStatusBadge.jsx';
import { ThemeSelect } from '../components/ThemeSelect.jsx';
import { setMascotStyle } from '../components/YiliMascot.jsx';
import { getPartitions } from '../services/partitions.js';
import '../styles/global.css';

const TABS = [
  { id: 'works', label: '我的作品' },
  { id: 'favorites', label: '我的收藏' },
  { id: 'ideas', label: '我的想法' },
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

function ActionMenu({ children, label = '操作' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    // 找到最近的卡片父元素并提升层级
    const card = ref.current?.closest('.ym-stagger-item');
    if (card) {
      card.style.position = 'relative';
      card.style.zIndex = '10';
    }
    const onClick = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      if (card) {
        card.style.position = '';
        card.style.zIndex = '';
      }
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...smallBtnStyle, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        {label} <span style={{ fontSize: '10px' }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 9999,
            minWidth: '120px',
            backgroundColor: 'var(--ym-bg-card)',
            border: '1px solid var(--ym-border)',
            borderRadius: 'var(--ym-radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ProfileContentPlaceholder() {
  return (
    <div className="ym-profile-loading" aria-label="内容加载中" aria-busy="true">
      <div className="ym-profile-loading__row" />
      <div className="ym-profile-loading__row" />
      <div className="ym-profile-loading__row" />
    </div>
  );
}

export function ProfilePage() {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  // Issue #50：精选仅管理员可设，按钮仅管理员可见
  const [isAdminUser, setIsAdminUser] = useState(false);
  useEffect(() => {
    if (user?.id) {
      isAdmin(user.id).then(setIsAdminUser).catch(() => setIsAdminUser(false));
    } else {
      setIsAdminUser(false);
    }
  }, [user?.id]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'settings' ? 'settings' : 'works'));
  // 修复：URL 的 ?tab= 变化时同步 tab（否则从「个人中心」点「编辑主页」不刷新，需手动刷新才生效）
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'settings' || urlTab === 'works' || urlTab === 'favorites' || urlTab === 'ideas') {
      setTab(urlTab);
    }
  }, [searchParams]);
  // Issue #39 P3：我的信誉
  const [reputation, setReputation] = useState({ adopted_count: 0, helpful: 0, insightful: 0, professional: 0, friendly: 0 });

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

  // 我的想法（发布 + 关注）
  const [myIdeas, setMyIdeas] = useState([]);
  const [myIdeaFavorites, setMyIdeaFavorites] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

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
  // 联系方式（找回密码用）
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMsg, setContactMsg] = useState('');

  // 依力记忆（AI 助手 3.0）
  const [yiliMemory, setYiliMemory] = useState(null);
  const [yiliMemoryLoading, setYiliMemoryLoading] = useState(false);
  const [yiliMemoryMsg, setYiliMemoryMsg] = useState('');

  // 看板郎形象：'floating-ball' | 'live2d'
  const [mascotStyle, setMascotStyleLocal] = useState(() => {
    try {
      const v = localStorage.getItem('ym-mascot-style');
      if (v === 'live2d' || v === 'floating-ball') return v;
    } catch (_) { /* 忽略 */ }
    return 'floating-ball';
  });

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

  const loadIdeasTab = useCallback(async () => {
    if (!userId) return;
    setIdeasLoading(true);
    try {
      const [{ ideas: list }, favoritesList] = await Promise.all([
        getMyIdeas(userId, { pageSize: 50 }),
        getMyFavoritedIdeas(userId),
      ]);
      setMyIdeas(list);
      setMyIdeaFavorites(favoritesList);
    } catch (err) {
      console.error('加载我的想法失败:', err);
    } finally {
      setIdeasLoading(false);
    }
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
        email: p?.email || '',
        phone: p?.phone || '',
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
    if (tab === 'ideas') loadIdeasTab();
    if (tab === 'settings') loadProfile();
  }, [tab, userId, loadFavorites, loadProfile]);

  // Issue #39 P3：我的信誉
  useEffect(() => {
    if (!user?.id) return;
    getCommenterReputation(user.id)
      .then(setReputation)
      .catch(() => {});
  }, [user?.id]);

  const handleClearYiliMemory = async () => {
    if (!userId) return;
    if (!window.confirm('确定清除依力记住的所有偏好吗？')) return;
    setYiliMemoryLoading(true);
    try {
      const { error } = await clearMyMemory(userId);
      if (error) throw error;
      setYiliMemory(null);
      setYiliMemoryMsg('✅ 已清除记忆');
    } catch (err) {
      setYiliMemoryMsg('❌ 清除失败：' + (err.message || ''));
    } finally {
      setYiliMemoryLoading(false);
    }
  };

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
      // Issue #121：不向前端泄露内部错误细节，仅记录到控制台
      setSaveMsg('❌ 保存失败，请稍后重试');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ---------- 联系方式保存（补绑邮箱/手机，供找回密码） ----------
  const handleSaveContact = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setContactSaving(true);
    setContactMsg('');
    const email = (form.email || '').trim();
    const phone = (form.phone || '').trim();

    if (!email && !phone) {
      setContactMsg('请至少填写邮箱或手机号之一');
      setContactSaving(false);
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setContactMsg('邮箱格式不正确');
      setContactSaving(false);
      return;
    }
    if (phone && !/^\+?[0-9]{6,15}$/.test(phone)) {
      setContactMsg('手机号格式不正确（6-15 位数字，可带 + 区号）');
      setContactSaving(false);
      return;
    }
    if (email === (profile?.email || '') && phone === (profile?.phone || '')) {
      setContactMsg('联系方式未发生变化');
      setContactSaving(false);
      return;
    }

    try {
      await bindContact({ email: email || null, phone: phone || null });
      setContactMsg('✅ 联系方式已保存');
      loadProfile();
    } catch (err) {
      // Issue #121：不向前端泄露内部错误细节，仅记录到控制台
      setContactMsg('❌ 保存失败，请稍后重试');
      console.error(err);
    } finally {
      setContactSaving(false);
    }
  };

  // ---------- 渲染 ----------

  if (!me && !authLoading) {
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
          <div className="ym-space-head-info" style={{ flex: 1, minWidth: '220px', paddingBottom: '4px' }}>
            <h1 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '24px', fontWeight: '600', color: 'var(--ym-text-primary)', margin: 0 }}>
              {me?.email?.replace('@nav.local', '') || '我的主页'}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--ym-text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>
              {profile?.bio || '管理你的作品、收藏与创作者资料'}
            </p>
          </div>
          <Link to="/create" className="ym-btn ym-btn-primary">+ 新建作品</Link>
        </div>

        <div className="ym-profile-overview">
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

        {/* Issue #39 P3：我的信誉 */}
        <div className="ym-profile-reputation">
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '6px' }}>
              {reputationBadge(reputation).emoji} 我的评论者信誉 · {reputationBadge(reputation).label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', lineHeight: 1.7 }}>
              {reputation.adopted_count > 0
                ? `有 ${reputation.adopted_count} 条建议被作者采纳`
                : '还没有被采纳的建议，继续给出有价值的反馈吧'}
              <br />
              收到评价：有帮助 {reputation.helpful} · 有洞察 {reputation.insightful} · 专业 {reputation.professional} · 友善 {reputation.friendly}
            </div>
          </div>
          <div style={{ textAlign: 'right', alignSelf: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--ym-accent)' }}>{reputationScore(reputation)}</div>
            <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>信誉分</div>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="ym-tabs" role="tablist" aria-label="个人中心内容">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                // 同步 URL，刷新后保持当前 tab
                setSearchParams(t.id === 'works' ? {} : { tab: t.id }, { replace: true });
              }}
              className={'ym-tab' + (tab === t.id ? ' active' : '')}
              role="tab"
              aria-selected={tab === t.id}
              id={`profile-tab-${t.id}`}
              aria-controls={`profile-panel-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        </div>

        <section key={tab} className="ym-profile-content" role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`}>

        {/* Tab1 我的作品 */}
        {tab === 'works' && (
          <div>
            <div className="ym-stagger-item" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', animationDelay: '0ms' }}>
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

            <div className="ym-profile-list-slot">
            {worksLoading ? <ProfileContentPlaceholder /> : works.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-secondary)' }}>暂无作品，点击右上角新建</div>
            ) : (
              works.map((w, index) => (
                <div key={`${selectedGroup}-${worksPage}-${w.id}`} className="ym-stagger-item" style={{ display: 'flex', gap: '14px', padding: '14px 16px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center', animationDelay: `${55 + Math.min(index, 8) * 55}ms` }}>
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
                  <div className="ym-profile-work-actions">
                    <ThemeSelect className="ym-theme-select--compact" value={w.group_id || 'none'} onChange={(groupId) => handleAssignGroup(w.id, groupId)} ariaLabel={`${w.title} 的分组`} options={[{ value: 'none', label: '未分组' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
                    <ActionMenu label="管理">
                      {isAdminUser && (
                        <button className="ym-profile-action-menu-item" onClick={() => handleToggleFeatured(w)} style={actionMenuItemStyle}>
                          {w.featured ? '取消精选' : '设精选'}
                        </button>
                      )}
                      <button className="ym-profile-action-menu-item" onClick={() => handleToggleVisibility(w)} style={actionMenuItemStyle}>
                        {w.visibility === 'private' ? '设为公开' : '设为私密'}
                      </button>
                      <Link className="ym-profile-action-menu-item" to={`/website/${w.id}/edit`} style={{ ...actionMenuItemStyle, textDecoration: 'none', display: 'inline-flex' }}>编辑</Link>
                      <button className="ym-profile-action-menu-item ym-profile-action-menu-item--danger" onClick={() => handleDeleteWork(w)} style={{ ...actionMenuItemStyle, color: 'var(--ym-danger)' }}>删除</button>
                    </ActionMenu>
                  </div>
                </div>
              ))
            )}
            </div>

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
          <div className="ym-profile-list-slot">
            {favoritesLoading ? <ProfileContentPlaceholder /> : favorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ym-text-secondary)' }}>还没有收藏，去详情页点「收藏」吧</div>
            ) : (
              favorites.map((fav, index) => (
                <div key={fav.favorite_id} className="ym-stagger-item" style={{ display: 'flex', gap: '14px', padding: '12px 16px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap', animationDelay: `${index * 55}ms` }}>
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

﻿        {/* Tab3 我的想法 */}
        {tab === 'ideas' && (
          <div className="ym-profile-list-slot">
            {ideasLoading ? <ProfileContentPlaceholder /> : (
              <>
                <h3 className="ym-stagger-item" style={{ fontFamily: 'var(--ym-font-display)', fontSize: '16px', color: 'var(--ym-text-primary)', marginBottom: '10px', animationDelay: '0ms' }}>我发布的（{myIdeas.length}）</h3>
                {myIdeas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px dashed var(--ym-border)', marginBottom: '20px' }}>
                    还没有发布想法，去
                    <Link to="/ideas/new" style={{ color: 'var(--ym-accent)' }}> 发布第一条 </Link>
                    吧
                  </div>
                ) : (
                  myIdeas.map((idea, index) => (
                    <div key={idea.id} className="ym-stagger-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '10px', animationDelay: `${55 + Math.min(index, 8) * 55}ms` }}>
                      <IdeaStatusBadge status={idea.status} size="sm" />
                      <Link to={`/ideas/${idea.id}`} style={{ flex: 1, minWidth: '160px', fontSize: '15px', color: 'var(--ym-text-primary)', textDecoration: 'none' }}>
                        {idea.title}
                      </Link>
                      <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>👍 {idea.vote_count} · 💬 {idea.comment_count} · {new Date(idea.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  ))
                )}

                <h3 className="ym-stagger-item" style={{ fontFamily: 'var(--ym-font-display)', fontSize: '16px', color: 'var(--ym-text-primary)', margin: '20px 0 10px', animationDelay: '165ms' }}>我关注的（{myIdeaFavorites.length}）</h3>
                {myIdeaFavorites.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--ym-text-secondary)', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px dashed var(--ym-border)' }}>
                    关注想法后，它的状态进展会出现在这里
                  </div>
                ) : (
                  myIdeaFavorites.map((f, index) => (
                    <div key={f.favorite_id} className="ym-stagger-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-md)', border: '1px solid var(--ym-border)', marginBottom: '10px', animationDelay: `${220 + Math.min(index, 8) * 55}ms` }}>
                      <IdeaStatusBadge status={f.idea.status} size="sm" />
                      <Link to={`/ideas/${f.idea.id}`} style={{ flex: 1, minWidth: '160px', fontSize: '15px', color: 'var(--ym-text-primary)', textDecoration: 'none' }}>
                        {f.idea.title}
                      </Link>
                      <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>{new Date(f.favorited_at).toLocaleDateString('zh-CN')} 关注</span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* Tab4 设置 */}

        {tab === 'settings' && (
          <div>
            {settingsLoading ? <ProfileContentPlaceholder /> : (
              <form onSubmit={handleSaveSettings} className="ym-stagger-item" style={{ backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-lg)', border: '1px solid var(--ym-border)', padding: '24px', animationDelay: '0ms' }}>
                <h3 className="ym-stagger-item" style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', marginBottom: '16px', animationDelay: '55ms' }}>基本资料</h3>

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
                    <ThemeSelect value={form.collab_status || 'open'} onChange={(collab_status) => setForm({ ...form, collab_status })} ariaLabel="合作状态" options={[{ value: 'open', label: '开放合作' }, { value: 'limited', label: '有限合作' }, { value: 'closed', label: '暂不合作' }]} />
                  </div>
                  <div>
                    <label style={labelStyle}>商业委托</label>
                    <ThemeSelect value={form.commission_status || 'open'} onChange={(commission_status) => setForm({ ...form, commission_status })} ariaLabel="商业委托" options={[{ value: 'open', label: '接受委托' }, { value: 'closed', label: '暂不接受' }]} />
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

                {/* 看板郎形象切换 */}
                <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', margin: '28px 0 16px' }}>看板郎形象</h3>
                <div style={{ backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-md)', padding: '16px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', margin: '0 0 12px' }}>
                    选择看板郎的显示方式。切换后即时生效。
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[
                      { value: 'floating-ball', label: '浮动球', desc: '经典圆形头像，眨眼呼吸动画' },
                      { value: 'live2d', label: '动态形象', desc: '多姿态切换，交互更丰富' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setMascotStyleLocal(opt.value);
                          setMascotStyle(opt.value);
                        }}
                        style={{
                          padding: '12px 20px',
                          borderRadius: 'var(--ym-radius-md)',
                          border: `2px solid ${mascotStyle === opt.value ? 'var(--ym-accent)' : 'var(--ym-border)'}`,
                          backgroundColor: mascotStyle === opt.value ? 'var(--ym-accent-soft, rgba(var(--ym-accent-rgb, 99,102,241),0.08))' : 'var(--ym-bg-card)',
                          color: 'var(--ym-text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all var(--ym-transition)',
                          flex: '1 1 160px',
                          minWidth: '160px',
                        }}
                      >
                        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{opt.label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 依力记忆（AI 助手 3.0）：展示/清除个性化记忆 */}
                <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', margin: '28px 0 16px' }}>依力记忆（AI 助手）</h3>
                <div style={{ backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-md)', padding: '16px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', margin: '0 0 12px' }}>
                    依力会记住你和她说过的偏好（如「我喜欢科幻」），让推荐更懂你。仅你本人可见，随时可清除；也可在聊天面板右上角用 🧠/💤 开关停用。
                  </p>
                  {yiliMemoryLoading ? null : yiliMemory?.memory_text ? (
                    <>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.7, color: 'var(--ym-text-primary)', backgroundColor: 'var(--ym-bg-card)', borderRadius: 'var(--ym-radius-sm)', padding: '12px', margin: '0 0 10px' }}>{yiliMemory.memory_text}</pre>
                      {Array.isArray(yiliMemory.preferences?.likes) && yiliMemory.preferences.likes.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {yiliMemory.preferences.likes.map((t) => (
                            <span key={t} style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '999px', backgroundColor: 'var(--ym-accent-soft)', color: 'var(--ym-accent)' }}>喜欢 {t}</span>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={handleClearYiliMemory} disabled={yiliMemoryLoading} style={{ ...smallBtnStyle, color: 'var(--ym-danger)', borderColor: 'var(--ym-danger)' }}>清除记忆</button>
                    </>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--ym-text-muted)' }}>暂无记忆。和依力聊天时说出你的偏好，她会记住并用于推荐。</div>
                  )}
                  {yiliMemoryMsg && (
                    <div style={{ fontSize: '13px', marginTop: '10px', color: yiliMemoryMsg.startsWith('✅') ? 'var(--ym-success)' : 'var(--ym-danger)' }}>{yiliMemoryMsg}</div>
                  )}
                </div>
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

                {/* 账号安全：补绑邮箱/手机号（找回密码用） */}
                <h3 style={{ fontFamily: 'var(--ym-font-display)', fontSize: '18px', color: 'var(--ym-text-primary)', margin: '28px 0 16px' }}>账号安全</h3>
                <div style={{ backgroundColor: 'var(--ym-bg-subtle)', borderRadius: 'var(--ym-radius-md)', padding: '16px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--ym-text-secondary)', margin: '0 0 12px' }}>
                    绑定邮箱或手机号后，可在登录页通过验证码找回密码。已绑定信息仅你本人可见。
                  </p>
                  {/* 未绑定提醒：本站账号是「用户名 + @nav.local 假邮箱」，不补绑就永远无法自助找回密码 */}
                  {profile && !profile.email && !profile.phone && (
                    <div style={{
                      padding: '10px 12px',
                      marginBottom: '12px',
                      borderRadius: 'var(--ym-radius-sm)',
                      backgroundColor: 'var(--ym-warning-bg, #fff7e6)',
                      color: 'var(--ym-warning, #b26a00)',
                      borderLeft: '4px solid var(--ym-warning, #b26a00)',
                      fontSize: '13px',
                      lineHeight: 1.7,
                    }}>
                      ⚠️ 你还没有绑定邮箱或手机号。一旦忘记密码将<b>无法自助找回</b>，只能联系管理员处理。建议现在补一个邮箱。
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <div>
                      <label style={labelStyle}>邮箱</label>
                      <input
                        type="email"
                        value={form.email || ''}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        style={inputStyle}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>手机号</label>
                      <input
                        type="tel"
                        value={form.phone || ''}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        style={inputStyle}
                        placeholder="13800138000"
                      />
                    </div>
                  </div>
                  {contactMsg && (
                    <div style={{ padding: '8px 12px', marginBottom: '12px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: contactMsg.startsWith('✅') ? 'var(--ym-success-bg)' : 'var(--ym-danger-bg)', color: contactMsg.startsWith('✅') ? 'var(--ym-success)' : 'var(--ym-danger)', fontSize: '13px' }}>
                      {contactMsg}
                    </div>
                  )}
                  <button type="button" onClick={handleSaveContact} disabled={contactSaving} style={{ padding: '8px 24px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: 'var(--ym-radius-sm)', fontSize: '14px', fontWeight: '500', cursor: contactSaving ? 'not-allowed' : 'pointer', opacity: contactSaving ? 0.6 : 1 }}>
                    {contactSaving ? '保存中...' : '保存联系方式'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
        </section>
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

const actionMenuItemStyle = {
  width: '100%',
  textAlign: 'left',
  padding: '7px 10px',
  fontSize: '13px',
  border: 'none',
  borderRadius: 'var(--ym-radius-sm)',
  backgroundColor: 'transparent',
  color: 'var(--ym-text-secondary)',
  cursor: 'pointer',
  transition: 'background-color var(--ym-transition), color var(--ym-transition)',
};


