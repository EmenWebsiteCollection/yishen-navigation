// src/pages/CreateWebsitePage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { createWebsite } from '../services/websites.js';
import { fetchWebsiteScreenshot, uploadWebsiteImage, validateImageFile } from '../services/screenshot.js';
import '../styles/global.css';

export function CreateWebsitePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 处理文件选择
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const error = validateImageFile(file);
    if (error) {
      setMessage({ type: 'error', text: error });
      setImageFile(null);
      setImagePreview('');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMessage({ type: '', text: '' });
  };

  // 自动截图
  const handleAutoScreenshot = async () => {
    if (!url) {
      setMessage({ type: 'error', text: '请先输入 URL' });
      return;
    }
    setUploading(true);
    try {
      const screenshotUrl = await fetchWebsiteScreenshot(url);
      if (screenshotUrl) {
        // 直接使用截图 URL（外部图片，无需上传到 Supabase）
        setImagePreview(screenshotUrl);
        // 存储为外部 URL，不需要上传文件
        setImageFile(null); // 标记为外部 URL
        setMessage({ type: 'success', text: '✅ 截图获取成功' });
      } else {
        setMessage({ type: 'error', text: '截图获取失败，请手动上传图片' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '截图获取失败: ' + err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!user) {
      setMessage({ type: 'error', text: '请先登录再提交网站。' });
      return;
    }
    if (!url.trim() || !title.trim()) {
      setMessage({ type: 'error', text: 'URL 和标题不能为空。' });
      return;
    }
    try {
      new URL(url);
    } catch (_) {
      setMessage({ type: 'error', text: '请输入有效的 URL（包含协议，如 https://）。' });
      return;
    }

    setLoading(true);
    try {
      let finalImageUrl = null;

      // 如果有上传的图片文件，先上传到 Supabase Storage
      if (imageFile) {
        const uploadedUrl = await uploadWebsiteImage(imageFile, user.id);
        finalImageUrl = uploadedUrl;
      } else if (imagePreview && imagePreview.startsWith('http')) {
        // 如果是自动截图获取的外部 URL，直接使用
        finalImageUrl = imagePreview;
      }

      await createWebsite(url.trim(), title.trim(), description.trim(), user.id, finalImageUrl);
      setMessage({ type: 'success', text: '✅ 网站提交成功！' });
      setUrl('');
      setTitle('');
      setDescription('');
      setImageFile(null);
      setImagePreview('');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '提交失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '600px',
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
        提交新网站
      </h2>
      <form onSubmit={handleSubmit}>
        {/* URL 输入框 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="create-url" style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            URL
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="create-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              style={{
                flex: 1,
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
            <button
              type="button"
              onClick={handleAutoScreenshot}
              disabled={uploading}
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--ym-accent)',
                color: 'var(--ym-accent-text-on)',
                border: 'none',
                borderRadius: 'var(--ym-radius-sm)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.6 : 1,
                whiteSpace: 'nowrap',
                transition: 'background-color var(--ym-transition)',
              }}
              onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)'; }}
              onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = 'var(--ym-accent)'; }}
            >
              {uploading ? '截图中...' : '自动截图'}
            </button>
          </div>
        </div>

        {/* 标题输入框 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="create-title" style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            标题
          </label>
          <input
            id="create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="网站标题"
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

        {/* 描述输入框 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="create-desc" style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            详情描述（可选）
          </label>
          <textarea
            id="create-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述网站内容..."
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

        {/* 图片上传 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--ym-text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
            网站图片（可选，支持 PNG/JPG/GIF/WebP，≤5MB）
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ width: '100%', padding: '6px 0' }}
          />
          {imagePreview && (
            <div style={{ marginTop: '8px' }}>
              <img src={imagePreview} alt="预览" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: 'var(--ym-radius-sm)', border: '1px solid var(--ym-border)' }} />
            </div>
          )}
        </div>

        {message.text && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: 'var(--ym-radius-sm)',
            backgroundColor: message.type === 'error' ? 'var(--ym-danger-bg)' : 'var(--ym-success-bg)',
            color: message.type === 'error' ? 'var(--ym-danger)' : 'var(--ym-success)',
            borderLeft: `4px solid ${message.type === 'error' ? 'var(--ym-danger)' : 'var(--ym-success)'}`,
            fontSize: '14px',
            animation: 'ym-slide-down var(--ym-transition) forwards',
          }}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || uploading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: (loading || uploading) ? 'var(--ym-accent)' : 'var(--ym-accent)',
            color: 'var(--ym-accent-text-on)',
            border: 'none',
            borderRadius: 'var(--ym-radius-sm)',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'background-color var(--ym-transition), opacity var(--ym-transition)',
            cursor: (loading || uploading) ? 'not-allowed' : 'pointer',
            opacity: (loading || uploading) ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (!loading && !uploading) e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)';
          }}
          onMouseLeave={(e) => {
            if (!loading && !uploading) e.currentTarget.style.backgroundColor = 'var(--ym-accent)';
          }}
        >
          {loading ? (
            <>
              <span className="ym-spin" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid var(--ym-accent-text-on)', borderTopColor: 'transparent', borderRadius: '50%' }} />
              提交中...
            </>
          ) : '提交网站'}
        </button>
      </form>
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Link to="/" style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', transition: 'color var(--ym-transition)', textDecoration: 'none' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ym-text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ym-text-secondary)'}
        >
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}