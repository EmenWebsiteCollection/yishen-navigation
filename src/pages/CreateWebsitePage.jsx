// src/pages/CreateWebsitePage.jsx
// 新建作品：类型选择（网站需 URL + 自动截图；其他类型可传图）、公开/私密、状态、分组、更新日志
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { createWork, listGroups, WORK_TYPES, WORK_STATUS, CREATIVE_TYPES, AI_DEGREES, AUDIENCES, CONTENT_WARNINGS } from '../services/works.js';
import { fetchWebsiteScreenshot, uploadWebsiteImage, validateImageFile } from '../services/screenshot.js';
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

export function CreateWebsitePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workType, setWorkType] = useState('website');
  const [url, setUrl] = useState('');
const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [groupId, setGroupId] = useState('');
  const [changelog, setChangelog] = useState('');
  // Issue #39 P1：创作标签体系
  const [tagsText, setTagsText] = useState('');
  const [stylesText, setStylesText] = useState('');
  const [toolsText, setToolsText] = useState('');
  const [creativeType, setCreativeType] = useState('');
  const [completion, setCompletion] = useState('');
  const [seekingCollab, setSeekingCollab] = useState(false);
  const [derivativeAllowed, setDerivativeAllowed] = useState(true);
  const [commercialUse, setCommercialUse] = useState(false);
  const [aiDegree, setAiDegree] = useState('unknown');
  const [audience, setAudience] = useState('');
  const [contentWarning, setContentWarning] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!user) return;
    listGroups(user.id)
      .then(setGroups)
      .catch((err) => console.warn('加载分组失败:', err.message));
  }, [user]);

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
      setMessage({ type: 'error', text: '请先登录再提交作品。' });
      return;
    }
    if (!title.trim()) {
      setMessage({ type: 'error', text: '标题不能为空。' });
      return;
    }
    if (workType === 'website') {
      if (!url.trim()) {
        setMessage({ type: 'error', text: '网站类作品必须填写 URL。' });
        return;
      }
      try {
        new URL(url);
      } catch (_) {
        setMessage({ type: 'error', text: '请输入有效的 URL（包含协议，如 https://）。' });
        return;
      }
    }
    if (videoUrl.trim()) {
      try {
        new URL(videoUrl.trim());
      } catch (_) {
        setMessage({ type: 'error', text: '演示视频链接无效（需包含协议，如 https://）。' });
        return;
      }
    }

    setLoading(true);
    let finalImageUrl = null;

    try {
      if (imageFile) {
        // 用户手动上传了图片
        setMessage({ type: 'info', text: '正在上传图片...' });
        finalImageUrl = await uploadWebsiteImage(imageFile, user.id);
      } else if (workType === 'website') {
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

      // 提交作品
      await createWork(
        {
          url: url.trim(),
          title: title.trim(),
          description: description.trim(),
          image_url: finalImageUrl,
          video_url: videoUrl.trim() || null,
          work_type: workType,
          status: status || null,
          visibility,
          group_id: groupId || null,
          changelog: changelog.trim() || null,
          tags: tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          styles: stylesText.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          tools: toolsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          creative_type: creativeType || null,
          completion: completion === '' ? null : Number(completion),
          seeking_collab: seekingCollab,
          derivative_allowed: derivativeAllowed,
          commercial_use: commercialUse,
          ai_degree: aiDegree,
          audience: audience || null,
          content_warning: contentWarning,
        },
        user.id
      );
      setMessage({ type: 'success', text: '✅ 作品提交成功！' });
      setUrl('');
      setVideoUrl('');
      setTitle('');
      setDescription('');
      setStatus('');
      setVisibility('public');
      setGroupId('');
      setChangelog('');
      setTagsText('');
      setStylesText('');
      setToolsText('');
      setCreativeType('');
      setCompletion('');
      setSeekingCollab(false);
      setDerivativeAllowed(true);
      setCommercialUse(false);
      setAiDegree('unknown');
      setAudience('');
      setContentWarning([]);
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
        新建作品
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
            <label htmlFor="create-url" style={labelStyle}>URL</label>
            <input
              id="create-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              style={inputStyle}
            />
          </div>
        )}

        {/* 演示视频链接（可选） */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="create-video-url" style={labelStyle}>演示视频链接（可选）</label>
          <input
            id="create-video-url"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.bilibili.com/video/BV... 或 https://youtu.be/..."
            style={inputStyle}
          />
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
            填写后详情页展示「观看演示视频」入口，点击跳转到视频网站观看
          </div>
        </div>

        {/* 标题 */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="create-title" style={labelStyle}>标题</label>
          <input
            id="create-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={workType === 'website' ? '网站标题' : '作品标题'}
            required
            style={inputStyle}
          />
        </div>

        {/* 描述 */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="create-desc" style={labelStyle}>详情描述（可选）</label>
          <textarea
            id="create-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述作品内容..."
            rows="4"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* 图片上传 */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="create-image" style={labelStyle}>{workType === 'website' ? '网站大图（可选）' : '作品图片（可选）'}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
              {workType === 'website' ? (
                <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
                  不上传时将自动截取网站首页完整页面
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
                  支持 PNG/JPG/GIF/WebP，≤5MB
                </div>
              )}
            </div>
          </div>
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
            <label style={labelStyle}>分组（可选）</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={inputStyle}>
              <option value="">未分组</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Issue #39 P1：创作标签与信息 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '10px' }}>
            创作标签与信息（除 AI 参与程度外均可选）
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>AI 参与程度（必填，合规标识）</label>
            <select value={aiDegree} onChange={(e) => setAiDegree(e.target.value)} style={inputStyle}>
              {AI_DEGREES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
              依据《人工智能生成合成内容标识办法》，AI 生成内容需显式+隐式标识；选「未知」时平台会加注风险提示。
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>创作类型</label>
              <select value={creativeType} onChange={(e) => setCreativeType(e.target.value)} style={inputStyle}>
                <option value="">未设置</option>
                {CREATIVE_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>完成度（0-100）</label>
              <input type="number" min="0" max="100" value={completion} onChange={(e) => setCompletion(e.target.value)} placeholder="如 60" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>适合受众</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} style={inputStyle}>
                <option value="">未设置</option>
                {AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>标签（逗号分隔，最多 10 个，每个 ≤20 字）</label>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="如：AI 工具, 开源, 效率" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>风格（逗号分隔）</label>
              <input value={stylesText} onChange={(e) => setStylesText(e.target.value)} placeholder="如：极简, 像素" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>使用工具（逗号分隔）</label>
              <input value={toolsText} onChange={(e) => setToolsText(e.target.value)} placeholder="如：Figma, PS" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '12px', fontSize: '14px', color: 'var(--ym-text-secondary)' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={seekingCollab} onChange={(e) => setSeekingCollab(e.target.checked)} />
              寻找合作
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={derivativeAllowed} onChange={(e) => setDerivativeAllowed(e.target.checked)} />
              允许二次创作
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={commercialUse} onChange={(e) => setCommercialUse(e.target.checked)} />
              可商用
            </label>
          </div>

          <div style={{ marginBottom: '4px' }}>
            <label style={labelStyle}>内容警告（可多选）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {CONTENT_WARNINGS.map((cw) => (
                <label key={cw.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--ym-text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={contentWarning.includes(cw.id)}
                    onChange={(e) => {
                      setContentWarning((prev) =>
                        e.target.checked ? [...prev, cw.id] : prev.filter((x) => x !== cw.id)
                      );
                    }}
                  />
                  {cw.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 更新日志 */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="create-changelog" style={labelStyle}>更新日志（可选）</label>
          <textarea
            id="create-changelog"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="记录作品的更新内容..."
            rows="2"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
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
          ) : '提交作品'}
        </button>
      </form>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Link to="/" style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', textDecoration: 'none' }}>← 返回首页</Link>
      </div>
    </div>
  );
}
