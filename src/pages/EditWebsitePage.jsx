// src/pages/EditWebsitePage.jsx
// 编辑作品：类型/URL/标题/描述/图片/状态/公开·私密/分组/更新日志
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWorkById, updateWork, listGroups, WORK_TYPES, WORK_STATUS } from '../services/works.js';
import { uploadWebsiteImage, validateImageFile } from '../services/screenshot.js';
import '../styles/global.css';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--ym-border)',
  borderRadius: 'var(--ym-radius-sm)',
  fontSize: '15px',
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

export function EditWebsitePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [url, setUrl] = useState('');
const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState('website');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [groupId, setGroupId] = useState('');
  const [changelog, setChangelog] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setError('请先登录');
      setLoading(false);
      return;
    }
    const loadWork = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getWorkById(id, user.id);
        if (!data) {
          setError('作品不存在');
          return;
        }
        if (user.id !== data.user_id) {
          setError('您没有权限编辑此作品');
          return;
        }
        setUrl(data.url || '');
        setVideoUrl(data.video_url || '');
        setTitle(data.title);
        setDescription(data.description || '');
        setWorkType(data.work_type || 'website');
        setStatus(data.status || '');
        setVisibility(data.visibility || 'public');
        setGroupId(data.group_id || '');
        setChangelog(data.changelog || '');
        setImageUrl(data.image_url || '');
        setImagePreview(data.image_url || '');
        setGroups(await listGroups(user.id));
      } catch (err) {
        setError('加载作品信息失败，请稍后重试');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadWork();
  }, [id, user, authLoading]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      setImageFile(null);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
  };

  // 删除图片
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }
    if (workType === 'website') {
      if (!url.trim()) {
        setError('网站类作品必须填写 URL');
        return;
      }
      try {
        new URL(url.trim());
      } catch (_) {
        setError('请输入有效的 URL（包含协议，如 https://）。');
        return;
      }
    }
    if (videoUrl.trim()) {
      try {
        new URL(videoUrl.trim());
      } catch (_) {
        setError('演示视频链接无效（需包含协议，如 https://）。');
        return;
      }
    }

    setSaving(true);
    try {
      let finalImageUrl = null;
      if (!imagePreview && !imageFile) {
        finalImageUrl = null;
      } else if (imageFile) {
        finalImageUrl = await uploadWebsiteImage(imageFile, user.id);
      } else if (imagePreview && imagePreview.startsWith('http')) {
        finalImageUrl = imageUrl;
      } else {
        finalImageUrl = null;
      }

      await updateWork(id, {
        url: url.trim(),
        title: title.trim(),
        description: description.trim() || '',
        image_url: finalImageUrl,
        video_url: videoUrl.trim() || null,
        work_type: workType,
        status: status || null,
        visibility,
        group_id: groupId || null,
        changelog: changelog.trim() || null,
      });
      setMessage('✅ 保存成功！');
      setTimeout(() => navigate(`/website/${id}`), 1500);
    } catch (err) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--ym-text-secondary)' }}>加载中...</div>;
  }

  if (error && !message) {
    return (
      <div style={{
        maxWidth: '560px',
        margin: '60px auto',
        padding: '32px 28px',
        backgroundColor: 'var(--ym-bg-card)',
        borderRadius: 'var(--ym-radius-lg)',
        border: '1px solid var(--ym-border)',
        textAlign: 'center',
      }}>
        <p style={{ color: 'var(--ym-danger)' }}>{error}</p>
        <Link to="/" style={{ color: 'var(--ym-accent)', fontSize: '14px', marginTop: '12px', display: 'inline-block', textDecoration: 'none' }}>
          返回首页
        </Link>
      </div>
    );
  }

  const hasImage = imagePreview || imageUrl;

  return (
    <div className="ym-detail-layout">
      <div className="ym-section-block" style={{ padding: '28px' }}>
      <h2 style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '22px',
        fontWeight: '500',
        color: 'var(--ym-text-primary)',
        marginBottom: '24px',
        letterSpacing: '1px',
      }}>
        编辑作品
      </h2>
      <form onSubmit={handleSubmit}>
        {/* 作品类型 */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>作品类型</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {WORK_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setWorkType(t.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--ym-border)',
                  backgroundColor: workType === t.id ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
                  color: workType === t.id ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all var(--ym-transition)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL（仅网站类） */}
        {workType === 'website' && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="edit-url" style={labelStyle}>URL</label>
            <input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://example.com"
              style={inputStyle}
            />
          </div>
        )}

        {/* 演示视频链接（可选） */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-video-url" style={labelStyle}>演示视频链接（可选）</label>
          <input
            id="edit-video-url"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.bilibili.com/video/BV... 或 https://youtu.be/..."
            style={inputStyle}
          />
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
            填写后详情页展示「观看演示视频」入口，点击跳转到视频网站观看；留空则移除
          </div>
        </div>

        {/* 标题 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-title" style={labelStyle}>标题</label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        {/* 描述 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-desc" style={labelStyle}>详情描述</label>
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* 图片上传与删除 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>作品图片（可选，支持 PNG/JPG/GIF/WebP，≤5MB）</label>
          {hasImage && (
            <div style={{ marginBottom: '8px', position: 'relative' }}>
              <img
                src={imagePreview || imageUrl}
                alt="预览"
                style={{
                  maxWidth: '100%',
                  maxHeight: '160px',
                  borderRadius: 'var(--ym-radius-sm)',
                  border: '1px solid var(--ym-border)',
                }}
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  padding: '4px 12px',
                  backgroundColor: 'var(--ym-danger)',
                  color: 'var(--ym-danger-text-on)',
                  border: 'none',
                  borderRadius: 'var(--ym-radius-sm)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                删除图片
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ width: '100%', padding: '6px 0' }}
          />
        </div>

        {/* 状态 / 可见性 / 分组 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>创作状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              <option value="">未设置</option>
              {WORK_STATUS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>可见性</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={inputStyle}>
              <option value="public">公开</option>
              <option value="private">私密</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>分组</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={inputStyle}>
              <option value="">未分组</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 更新日志 */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="edit-changelog" style={labelStyle}>更新日志（可选）</label>
          <textarea
            id="edit-changelog"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            rows="3"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            backgroundColor: 'var(--ym-success-bg)',
            color: 'var(--ym-success)',
            borderRadius: 'var(--ym-radius-sm)',
            borderLeft: '4px solid var(--ym-success)',
            fontSize: '14px',
            animation: 'ym-slide-down var(--ym-transition) forwards',
          }}>
            {message}
          </div>
        )}
        {error && !message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            backgroundColor: 'var(--ym-danger-bg)',
            color: 'var(--ym-danger)',
            borderRadius: 'var(--ym-radius-sm)',
            borderLeft: '4px solid var(--ym-danger)',
            fontSize: '14px',
            animation: 'ym-slide-down var(--ym-transition) forwards',
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 28px',
              backgroundColor: 'var(--ym-accent)',
              color: 'var(--ym-accent-text-on)',
              border: 'none',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '15px',
              fontWeight: '500',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <Link to={`/website/${id}`} style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', textDecoration: 'none' }}>取消</Link>
        </div>
      </form>
      </div>

      <aside className="ym-detail-side">
        <div className="ym-section-block">
          <h3 className="ym-section-title" style={{ margin: '0 0 12px' }}>编辑提示</h3>
          <div style={{ fontSize: '13px', lineHeight: 1.8, color: 'var(--ym-text-secondary)' }}>
            <p>只能编辑自己上传的作品。</p>
            <p>网站类作品必须保留有效 URL。</p>
            <p>删除图片并保存后，详情页将不再展示大图。</p>
            <p>更新日志会展示在作品详情页。</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
