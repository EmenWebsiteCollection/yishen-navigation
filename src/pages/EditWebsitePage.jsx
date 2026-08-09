// src/pages/EditWebsitePage.jsx
// 编辑作品：类型/URL/标题/描述/图片/状态/公开·私密/分组/更新日志
import React, { useEffect, useRef, useState } from 'react';

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getWorkById, updateWork, listGroups, WORK_TYPES, WORK_STATUS, isAdmin, CREATIVE_TYPES, AI_DEGREES, AUDIENCES, CONTENT_WARNINGS, workTypeLabel } from '../services/works.js';
import { getPartitions } from '../services/partitions.js';
import { uploadWebsiteImage, validateImageFile } from '../services/screenshot.js';
import { uploadWorkDeploy, deleteWorkDeploy, validateDeployFile, deployPreviewUrl } from '../services/workDeploy.js';
import { uploadWorkMedia, validateMediaFile } from '../services/media.js';
import { ThemeSelect } from '../components/ThemeSelect.jsx';
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

  // Issue #13：在线部署（可选）
  const deployInputRef = useRef(null);
  const [deployUrl, setDeployUrl] = useState('');
  const [deployFile, setDeployFile] = useState(null);
  const [deployBusy, setDeployBusy] = useState(false);
  const [deployMsg, setDeployMsg] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workType, setWorkType] = useState('website');
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
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [groups, setGroups] = useState([]);
  const [partitions, setPartitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);

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
        const [data, adminFlag] = await Promise.all([
          getWorkById(id, user.id),
          isAdmin(user.id).catch(() => false),
        ]);
        setIsAdminUser(!!adminFlag);
        if (!data) {
          setError('作品不存在');
          return;
        }
        if (user.id !== data.user_id && !adminFlag) {
          setError('您没有权限编辑此作品');
          return;
        }
        setUrl(data.url || '');
        setVideoUrl(data.video_url || '');
        setDeployUrl(data.deploy_url || '');
        setTitle(data.title);
        setDescription(data.description || '');
        setWorkType(data.work_type || 'website');
        setStatus(data.status || '');
        setVisibility(data.visibility || 'public');
        setGroupId(data.group_id || '');
        setChangelog(data.changelog || '');
        setTagsText((data.tags || []).join(', '));
        setStylesText((data.styles || []).join(', '));
        setToolsText((data.tools || []).join(', '));
        setCreativeType(data.creative_type || '');
        setCompletion(data.completion == null ? '' : String(data.completion));
        setSeekingCollab(!!data.seeking_collab);
        setDerivativeAllowed(data.derivative_allowed !== false);
        setCommercialUse(!!data.commercial_use);
        setAiDegree(data.ai_degree || 'unknown');
        setAudience(data.audience || '');
        setContentWarning(data.content_warning || []);
        setImageUrl(data.image_url || '');
        setImagePreview(data.image_url || '');
        setMediaUrl(data.media_url || '');
        setGroups(await listGroups(user.id));
        setPartitions(await getPartitions());
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

  // 媒体文件（视频/音频直链，Issue #39 P2）
  const handleMediaFileChange = (e) => {
    const file = e.target.files?.[0];
    setMessage('');
    setError('');
    if (!file) {
      setMediaFile(null);
      return;
    }
    try {
      validateMediaFile(file);
      setMediaFile(file);
    } catch (err) {
      setError(err.message);
      e.target.value = '';
    }
  };
  const handleUploadMedia = async () => {
    if (!mediaFile) return;
    setMediaUploading(true);
    setError('');
    setMessage('');
    try {
      const { url } = await uploadWorkMedia(mediaFile, id, user.id);
      setMediaUrl(url);
      setMediaFile(null);
      setMessage('✅ 媒体上传成功，保存后生效');
    } catch (err) {
      setError(err.message || '媒体上传失败');
    } finally {
      setMediaUploading(false);
    }
  };

  // 删除图片
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  };

'',
'  // Issue #13：在线部署（上传/删除）',
'  const handlePickDeploy = (file) => {',
'    try {',
'      validateDeployFile(file);',
'      setDeployFile(file);',
"      setDeployMsg('');",
'    } catch (err) {',
"      setDeployMsg('❌ ' + err.message);",
'      setDeployFile(null);',
'    }',
'  };',
'',
'  const handleUploadDeploy = async () => {',
'    if (!deployFile || deployBusy) return;',
'    setDeployBusy(true);',
"    setDeployMsg('');",
'    try {',
'      const dep = await uploadWorkDeploy(id, deployFile, user.id);',
'      setDeployUrl(dep.deploy_url);',
"      setDeployMsg('✅ 部署成功：' + dep.deploy_url);",
'      setDeployFile(null);',
'    } catch (err) {',
"      setDeployMsg('❌ 部署失败：' + err.message);",
'    } finally {',
'      setDeployBusy(false);',
'    }',
'  };',
'',
'  const handleDeleteDeploy = async () => {',
"    if (deployBusy || !window.confirm('确定删除在线部署吗？')) return;",
'    setDeployBusy(true);',
'    try {',
'      await deleteWorkDeploy(id, user.id);',
"      setDeployUrl('');",
"      setDeployMsg('已删除部署');",
'    } catch (err) {',
"      setDeployMsg('❌ 删除失败：' + err.message);",
'    } finally {',
'      setDeployBusy(false);',
'    }',
'  };'
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
      });
      setMessage('✅ 保存成功！');
      setTimeout(() => navigate(`/website/${id}`), 1500);
    } catch (err) {
      setError(err.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return null;

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
            {partitions.map((t) => (
              <button
                key={t.work_type || t.id}
                type="button"
                onClick={() => setWorkType(t.work_type)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--ym-border)',
                  backgroundColor: workType === t.work_type ? 'var(--ym-accent)' : 'var(--ym-bg-card)',
                  color: workType === t.work_type ? 'var(--ym-accent-text-on)' : 'var(--ym-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all var(--ym-transition)',
                }}
              >
                {t.name}
              </button>
            ))}
            {!partitions.some((t) => t.work_type === workType) && (
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--ym-accent)',
                  backgroundColor: 'var(--ym-accent)',
                  color: 'var(--ym-accent-text-on)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {workTypeLabel(workType)}
              </button>
            )}
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
            <ThemeSelect value={status} onChange={setStatus} ariaLabel="创作状态" options={[{ value: '', label: '未设置' }, ...WORK_STATUS.map((s) => ({ value: s.id, label: s.label }))]} />
          </div>
          <div>
            <label style={labelStyle}>可见性</label>
            <ThemeSelect value={visibility} onChange={setVisibility} ariaLabel="可见性" options={[{ value: 'public', label: '公开' }, { value: 'private', label: '私密' }]} />
          </div>
          <div>
            <label style={labelStyle}>分组</label>
            <ThemeSelect value={groupId} onChange={setGroupId} ariaLabel="分组" options={[{ value: '', label: '未分组' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
          </div>
        </div>

        {/* 媒体文件（视频/音频直链，Issue #39 P2） */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>媒体文件（可选，视频 mp4/webm ≤100MB，音频 mp3/ogg ≤30MB）</label>
          <input
            type="file"
            accept="video/mp4,video/webm,audio/mpeg,audio/ogg"
            onChange={handleMediaFileChange}
            style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}
          />
          {mediaUrl && (
            <div style={{ fontSize: '12px', color: 'var(--ym-text-secondary)', marginBottom: '6px', wordBreak: 'break-all' }}>
              当前媒体：{mediaUrl}
            </div>
          )}
          <button
            type="button"
            onClick={handleUploadMedia}
            disabled={!mediaFile || mediaUploading}
            style={{
              padding: '8px 18px',
              backgroundColor: mediaFile ? 'var(--ym-accent)' : 'var(--ym-bg-subtle)',
              color: mediaFile ? 'var(--ym-accent-text-on)' : 'var(--ym-text-muted)',
              border: 'none',
              borderRadius: 'var(--ym-radius-sm)',
              fontSize: '14px',
              cursor: mediaFile && !mediaUploading ? 'pointer' : 'not-allowed',
            }}
          >
            {mediaUploading ? '上传中...' : mediaFile ? '上传媒体并设为作品内嵌播放' : '选择文件后上传'}
          </button>
          <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '6px' }}>
            上传后作品详情页将内嵌播放器，支持视频/音频时间区间批注。
          </div>
        </div>

        {/* Issue #39 P1：创作标签与信息 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ym-text-primary)', marginBottom: '10px' }}>
            创作标签与信息
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>AI 参与程度（合规标识）</label>
            <ThemeSelect value={aiDegree} onChange={setAiDegree} ariaLabel="AI 参与程度" options={AI_DEGREES.map((d) => ({ value: d.id, label: d.label }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>创作类型</label>
              <ThemeSelect value={creativeType} onChange={setCreativeType} ariaLabel="创作类型" options={[{ value: '', label: '未设置' }, ...CREATIVE_TYPES.map((c) => ({ value: c.id, label: c.label }))]} />
            </div>
            <div>
              <label style={labelStyle}>完成度（0-100）</label>
              <input type="number" min="0" max="100" value={completion} onChange={(e) => setCompletion(e.target.value)} placeholder="如 60" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>适合受众</label>
              <ThemeSelect value={audience} onChange={setAudience} ariaLabel="适合受众" options={[{ value: '', label: '未设置' }, ...AUDIENCES.map((a) => ({ value: a.id, label: a.label }))]} />
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

          <div>
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
        {/* Issue #13：在线部署（可选） */}
        <div style={{ marginBottom: '18px', padding: '18px', border: '2px dashed var(--ym-border)', borderRadius: 'var(--ym-radius-md)', backgroundColor: 'var(--ym-bg-subtle)' }}>
          <div style={{ fontSize: '15px', color: 'var(--ym-text-primary)', marginBottom: '6px' }}>📦 在线部署（可选）</div>
          <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginBottom: '10px', lineHeight: 1.6 }}>
            上传 zip 自动部署为可访问的静态站点（≤50MB，仅支持纯静态 HTML/CSS/JS，不支持后端；SPA 子路由刷新会 404）。
          </div>
          {deployUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <a href={deployUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ym-accent)', fontSize: '13px', wordBreak: 'break-all' }}>🔗 在线预览：{deployUrl}</a>
              <button type="button" onClick={handleDeleteDeploy} disabled={deployBusy} style={{ padding: '4px 12px', border: '1px solid var(--ym-danger)', color: 'var(--ym-danger)', background: 'transparent', borderRadius: '8px', cursor: deployBusy ? 'not-allowed' : 'pointer', fontSize: '12px' }}>删除部署</button>
            </div>
          ) : (
            <div
              style={{ padding: '14px', border: '1px dashed var(--ym-border)', borderRadius: 'var(--ym-radius-sm)', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => deployInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePickDeploy(f); }}
            >
              <input ref={deployInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={(e) => handlePickDeploy(e.target.files?.[0])} />
              <div style={{ fontSize: '14px', color: 'var(--ym-text-secondary)' }}>拖拽 zip 到此处，或点击选择</div>
              {deployFile && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ym-text-primary)' }}>已选择：{deployFile.name}</span>
                  <button type="button" onClick={handleUploadDeploy} disabled={deployBusy} style={{ padding: '4px 14px', backgroundColor: 'var(--ym-accent)', color: 'var(--ym-accent-text-on)', border: 'none', borderRadius: '8px', cursor: deployBusy ? 'not-allowed' : 'pointer', fontSize: '12px' }}>{deployBusy ? '部署中...' : '开始部署'}</button>
                  <button type="button" onClick={() => setDeployFile(null)} style={{ padding: '4px 12px', border: '1px solid var(--ym-border)', color: 'var(--ym-text-secondary)', background: 'transparent', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>移除</button>
                </div>
              )}
            </div>
          )}
          {deployMsg && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: deployMsg.startsWith('✅') ? 'var(--ym-success)' : 'var(--ym-danger)', wordBreak: 'break-all' }}>{deployMsg}</div>
          )}
        </div>
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
