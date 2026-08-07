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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 处理文件选择
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setMessage({ type: '', text: '' });
    if (!file) {
      setImageFile(null);
      setImagePreview('');
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      setMessage({ type: 'error', text: err });
      e.target.value = '';
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
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
    let finalImageUrl = null;

    try {
      if (imageFile) {
        // 用户手动上传了图片
        setMessage({ type: 'info', text: '正在上传图片...' });
        finalImageUrl = await uploadWebsiteImage(imageFile, user.id);
      } else {
        // 自动截图（即使失败也继续提交，只是无图）
        setMessage({ type: 'info', text: '正在自动截图（最多约 20 秒）...' });
        setUploading(true);
        try {
          const screenshotUrl = await fetchWebsiteScreenshot(url.trim(), user.id);
          if (screenshotUrl && screenshotUrl.startsWith('http')) {
            finalImageUrl = screenshotUrl;
            setImagePreview(screenshotUrl);
            setMessage({ type: 'success', text: '✅ 截图获取成功' });
          } else {
            setMessage({ type: 'info', text: '⚠️ 自动截图失败，将以无图形式提交。' });
          }
        } catch (err) {
          setMessage({ type: 'info', text: '⚠️ 自动截图失败: ' + err.message + '，将以无图形式提交。' });
        } finally {
          setUploading(false);
        }
      }

      // 提交网站
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
      setUploading(false);
    }
  };

  return (
    <div
      className="ym-page-card"
      style={{
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
        提交新网站
      </h2>

      <form onSubmit={handleSubmit}>
        {/* URL */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="create-url" style={{
            display: 'block',
            fontSize: '13px',
            color: 'var(--ym-text-secondary)',
            marginBottom: '4px',
            fontWeight: '500',
          }}>
            URL
          </label>
          <input
            id="create-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
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
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(156,107,46,0.12)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 标题 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="create-title" style={{
            display: 'block',
            fontSize: '13px',
            color: 'var(--ym-text-secondary)',
            marginBottom: '4px',
            fontWeight: '500',
          }}>
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
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(156,107,46,0.12)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 描述 */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="create-desc" style={{
            display: 'block',
            fontSize: '13px',
            color: 'var(--ym-text-secondary)',
            marginBottom: '4px',
            fontWeight: '500',
          }}>
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
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(156,107,46,0.12)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ym-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 图片上传 */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="create-image" style={{
            display: 'block',
            fontSize: '13px',
            color: 'var(--ym-text-secondary)',
            marginBottom: '4px',
            fontWeight: '500',
          }}>
            网站大图（可选）
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{
              width: '120px',
              height: '68px',
              borderRadius: 'var(--ym-radius-sm)',
              border: '1px dashed var(--ym-border-strong)',
              overflow: 'hidden',
              backgroundColor: 'var(--ym-bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '12px',
              color: 'var(--ym-text-muted)',
            }}>
              {imagePreview ? (
                <img src={imagePreview} alt="预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                '无图片'
              )}
            </div>
            <div>
              <input
                id="create-image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ fontSize: '13px', color: 'var(--ym-text-secondary)' }}
              />
              <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
                不上传时将自动截取网站首页完整页面
              </div>
            </div>
          </div>
        </div>

        {/* 消息 */}
        {message.text && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: 'var(--ym-radius-sm)',
            backgroundColor: message.type === 'error'
              ? 'var(--ym-danger-bg)'
              : message.type === 'info'
                ? 'var(--ym-bg-subtle)'
                : 'var(--ym-success-bg)',
            color: message.type === 'error'
              ? 'var(--ym-danger)'
              : message.type === 'info'
                ? 'var(--ym-text-secondary)'
                : 'var(--ym-success)',
            borderLeft: `4px solid ${
              message.type === 'error'
                ? 'var(--ym-danger)'
                : message.type === 'info'
                  ? 'var(--ym-border-strong)'
                  : 'var(--ym-success)'
            }`,
            fontSize: '14px',
            animation: 'ym-slide-down var(--ym-transition) forwards',
          }}>
            {message.text}
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: loading ? 'var(--ym-accent)' : 'var(--ym-accent)',
            color: 'var(--ym-accent-text-on)',
            border: 'none',
            borderRadius: 'var(--ym-radius-sm)',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'background-color var(--ym-transition), opacity var(--ym-transition)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'var(--ym-accent-hover)';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'var(--ym-accent)';
          }}
        >
          {loading ? (
            <>
              <span className="ym-spin" style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid var(--ym-accent-text-on)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
              }} />
              {uploading ? '截图中...' : '提交中...'}
            </>
          ) : '提交网站'}
        </button>
      </form>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Link to="/" style={{
          color: 'var(--ym-text-secondary)',
          fontSize: '14px',
          transition: 'color var(--ym-transition)',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ym-text-primary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ym-text-secondary)'}
        >
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}