// src/pages/EditWebsitePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWebsiteById, updateWebsite } from '../services/websites.js';
import { uploadWebsiteImage, validateImageFile } from '../services/screenshot.js';
import '../styles/global.css';

export function EditWebsitePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
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
    const loadWebsite = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getWebsiteById(id);
        if (!data) {
          setError('网站不存在');
          return;
        }
        if (user.id !== data.user_id) {
          setError('您没有权限编辑此网站');
          return;
        }
        setUrl(data.url);
        setTitle(data.title);
        setDescription(data.description || '');
        setImageUrl(data.image_url || '');
        setImagePreview(data.image_url || '');
      } catch (err) {
        setError('加载网站信息失败，请稍后重试');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadWebsite();
  }, [id, user, authLoading]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      setImageFile(null);
      // 不改变预览，保留原来的
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
    // 如果有旧图片，但用户选择了新文件，我们标记为替换，删除按钮依然可用
  };

  // 删除图片
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl(''); // 清除数据库中的图片 URL
    // 注意：如果用户此时保存，image_url 会变为 null
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }
    if (!url.trim()) {
      setError('URL 不能为空');
      return;
    }
    try {
      new URL(url.trim());
    } catch (_) {
      setError('请输入有效的 URL（包含协议，如 https://）。');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = null;

      // 如果用户删除了图片（imageUrl 和 imagePreview 都为空，且 imageFile 为空）
      if (!imagePreview && !imageFile) {
        finalImageUrl = null;
      } else if (imageFile) {
        // 用户选择了新图片，上传
        const uploadedUrl = await uploadWebsiteImage(imageFile, user.id);
        finalImageUrl = uploadedUrl;
      } else if (imagePreview && imagePreview.startsWith('http')) {
        // 保留已有的图片 URL（未改变）
        finalImageUrl = imageUrl;
      } else {
        // 其他情况（例如 blob 但未上传，不会发生）
        finalImageUrl = null;
      }

      await updateWebsite(id, { 
        url: url.trim(), 
        title: title.trim(), 
        description: description.trim() || '',
        image_url: finalImageUrl
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

  if (error) {
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
    <div style={{
      maxWidth: '560px',
      margin: '60px auto',
      padding: '32px 28px',
      backgroundColor: 'var(--ym-bg-card)',
      borderRadius: 'var(--ym-radius-lg)',
      border: '1px solid var(--ym-border)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
    }}>
      <h2 style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '22px',
        fontWeight: '500',
        color: 'var(--ym-text-primary)',
        marginBottom: '24px',
        letterSpacing: '1px',
      }}>
        编辑网站
      </h2>
      <form onSubmit={handleSubmit}>
        {/* URL */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-url" style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            URL
          </label>
          <input
            id="edit-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://example.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--ym-border)',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '15px',
              backgroundColor: 'var(--ym-bg-card)',
              color: 'var(--ym-text-primary)',
              transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 标题 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-title" style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            标题
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--ym-border)',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '15px',
              backgroundColor: 'var(--ym-bg-card)',
              color: 'var(--ym-text-primary)',
              transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 描述 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="edit-desc" style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            详情描述
          </label>
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--ym-border)',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '15px',
              backgroundColor: 'var(--ym-bg-card)',
              color: 'var(--ym-text-primary)',
              resize: 'vertical',
              fontFamily: 'var(--ym-font-body)',
              transition: 'border-color var(--ym-transition), box-shadow var(--ym-transition)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border-strong)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--ym-focus-ring)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 图片上传与删除 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            网站图片（可选，支持 PNG/JPG/GIF/WebP，≤5MB）
          </label>
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
                  transition: 'background-color var(--ym-transition)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--ym-danger-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--ym-danger)'}
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
          {imageUrl && !imageFile && (
            <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
              当前已有图片，选择新文件或点击删除按钮移除。
            </div>
          )}
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
        {error && (
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
              backgroundColor: saving ? 'var(--ym-accent)' : 'var(--ym-accent)',
              color: 'var(--ym-accent-text-on)',
              border: 'none',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '15px',
              fontWeight: '500',
              transition: 'background-color var(--ym-transition), opacity var(--ym-transition)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)';
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = 'var(--ym-accent)';
            }}
          >
            {saving ? (
              <>
                <span className="ym-spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--ym-accent-text-on)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                保存中...
              </>
            ) : '保存'}
          </button>
          <Link
            to={`/website/${id}`}
            style={{
              color: 'var(--ym-text-secondary)',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'color var(--ym-transition)',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ym-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ym-text-secondary)'}
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}