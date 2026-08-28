// src/pages/CreateWebsitePage.jsx
// 新建作品：渐进披露三段式——① 必填（类型/标题/URL/描述/AI程度）
// ② 推荐（封面/状态/可见性/分组/标签）③ 高级选项（默认折叠：演示视频/下载/
// 版权/受众/内容预警/更新日志/zip部署）。
// 提交即跳详情页；网站封面截图异步执行，不再阻塞提交。
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { createWork, updateWork, listGroups, WORK_TYPES, WORK_STATUS, CREATIVE_TYPES, AI_DEGREES, AUDIENCES, CONTENT_WARNINGS, workTypeLabel, sanitizeHttpUrl } from '../services/works.js';
import { getPartitions } from '../services/partitions.js';
import { fetchWebsiteScreenshot, uploadWebsiteImage, validateImageFile } from '../services/screenshot.js';
import { uploadWorkDeploy, validateDeployFile } from '../services/workDeploy.js';
import { linkIdeaToWork, getIdeaById } from '../services/ideas.js';
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

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  margin: '22px 0 12px',
  paddingBottom: '8px',
  borderBottom: '1px solid var(--ym-border)',
};

const sectionNumStyle = {
  fontSize: '12px',
  fontWeight: '600',
  color: 'var(--ym-accent)',
};

const sectionTitleStyle = {
  fontSize: '14px',
  fontWeight: '600',
  color: 'var(--ym-text-primary)',
  letterSpacing: '0.5px',
};

const sectionHintStyle = {
  fontSize: '12px',
  color: 'var(--ym-text-muted)',
};

const fieldErrorStyle = {
  marginTop: '4px',
  fontSize: '12px',
  color: 'var(--ym-danger)',
};

export function CreateWebsitePage() {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [workType, setWorkType] = useState('website');
  const [url, setUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
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
  const [partitions, setPartitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  // 渐进披露：高级选项折叠 + 行内字段错误
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const clearFieldError = (key) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  // Issue #13：拖拽上传静态网站（可选）
  const deployInputRef = useRef(null);
  const [deployFile, setDeployFile] = useState(null);
  const [deployMsg, setDeployMsg] = useState('');

  // 从想法详情页「去实现」跳转过来时，携带 idea_id 自动关联
  // 兼容两种参数名：idea_id（任务卡约定）与 source_idea_id（早期实现沿用）
  const [searchParams] = useSearchParams();
  const sourceIdeaId = searchParams.get('source_idea_id') || searchParams.get('idea_id');
  const [sourceIdea, setSourceIdea] = useState(null);

  useEffect(() => {
    if (!sourceIdeaId) return;
    getIdeaById(sourceIdeaId)
      .then((idea) => setSourceIdea(idea))
      .catch(() => setSourceIdea({ title: '想法 #' + sourceIdeaId.slice(0, 8) }));
  }, [sourceIdeaId]);

  useEffect(() => {
    if (!user) return;
    listGroups(user.id)
      .then(setGroups)
      .catch((err) => console.warn('加载分组失败:', err.message));
    getPartitions().then(setPartitions).catch(() => setPartitions([]));
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

  const handlePickDeploy = (file) => {
    try {
      validateDeployFile(file);
      setDeployFile(file);
      setDeployMsg('');
    } catch (err) {
      setDeployMsg('❌ ' + err.message);
      setDeployFile(null);
    }
  };

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = '标题不能为空';
    if (workType === 'website') {
      if (!url.trim()) errs.url = '网站类作品必须填写 URL';
      else if (!sanitizeHttpUrl(url)) errs.url = '请输入有效的 URL（需以 http:// 或 https:// 开头）';
    }
    if (videoUrl.trim() && !sanitizeHttpUrl(videoUrl)) errs.videoUrl = '演示视频链接无效（需以 http:// 或 https:// 开头）';
    if (downloadUrl.trim() && !sanitizeHttpUrl(downloadUrl)) errs.downloadUrl = '软件下载链接无效（需以 http:// 或 https:// 开头）';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!user) {
      setMessage({ type: 'error', text: '请先登录再提交作品。' });
      return;
    }
    // Issue #124：匿名账号不能发布作品
    if (isAnonymous) {
      setMessage({ type: 'error', text: '匿名账号不能发布作品，请先注册/登录' });
      return;
    }

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.videoUrl || errs.downloadUrl) setShowAdvanced(true);
      setMessage({ type: 'error', text: '请修正表单中标红的必填项。' });
      return;
    }

    setLoading(true);
    let finalImageUrl = null;

    try {
      if (imageFile) {
        // 用户手动上传了图片
        setMessage({ type: 'info', text: '正在上传图片...' });
        setUploading(true);
        finalImageUrl = await uploadWebsiteImage(imageFile, user.id);
      }

      // 提交作品（网站封面截图移到提交后异步执行，不再阻塞）
      const createdWork = await createWork(
        {
          url: url.trim(),
          title: title.trim(),
          description: description.trim(),
          image_url: finalImageUrl,
          video_url: videoUrl.trim() || null,
          download_url: downloadUrl.trim() || null,
          work_type: workType,
          status: status || null,
          visibility,
          group_id: groupId || null,
          changelog: changelog.trim() || null,
          source_idea_id: sourceIdeaId || null,
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
      if (sourceIdeaId && createdWork?.id) {
        try {
          await linkIdeaToWork(sourceIdeaId, createdWork.id, user.id);
        } catch (linkErr) {
          console.warn('关联想法失败:', linkErr.message);
        }
      }

      // Issue #13：若选择了部署文件，创建后自动上传部署（等部署完成再跳转）
      let deployDelay = false;
      if (deployFile && createdWork?.id) {
        setMessage({ type: 'info', text: '作品已创建，正在部署网站文件...' });
        try {
          const dep = await uploadWorkDeploy(createdWork.id, deployFile, user.id);
          setDeployMsg('✅ 已部署：' + dep.deploy_url);
        } catch (depErr) {
          setDeployMsg('⚠️ 部署失败：' + depErr.message + '（可稍后到编辑页重新上传）');
        }
        deployDelay = true;
      }

      // 网站类无手动封面：后台异步截图并回填，不阻塞跳转
      if (workType === 'website' && !finalImageUrl && createdWork?.id && url.trim()) {
        fetchWebsiteScreenshot(url.trim(), user.id)
          .then((screenshotUrl) => {
            if (screenshotUrl && screenshotUrl.startsWith('http')) {
              return updateWork(createdWork.id, { title: title.trim(), image_url: screenshotUrl });
            }
            return null;
          })
          .catch((err) => console.warn('自动截图失败:', err));
      }

      setMessage({ type: 'success', text: '✅ 作品提交成功！' });
      if (deployDelay) {
        // 带部署文件时稍作停留让用户看到部署结果
        setTimeout(() => navigate(`/website/${createdWork.id}`), 1500);
      } else {
        navigate(`/website/${createdWork.id}`);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '提交失败，请稍后重试。' });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const inputWithErr = (key) => ({
    ...inputStyle,
    borderColor: fieldErrors[key] ? 'var(--ym-danger)' : 'var(--ym-border)',
  });

  return (
    <div className="ym-detail-layout ym-create-page">
      <div className="ym-section-block ym-create-panel ym-stagger-item" style={{ padding: '28px', '--ym-stagger-index': 0 }}>
      <h2 className="ym-create-title ym-stagger-item" style={{
        fontFamily: 'var(--ym-font-display)',
        fontSize: '22px',
        fontWeight: '500',
        color: 'var(--ym-text-primary)',
        marginBottom: '24px',
        letterSpacing: '1px',
        '--ym-stagger-index': 1,
      }}>
        新建作品
      </h2>

      {sourceIdea && (
        <div className="ym-create-source ym-stagger-item" style={{ padding: '10px 14px', marginBottom: '14px', borderRadius: 'var(--ym-radius-sm)', backgroundColor: 'var(--ym-success-bg)', color: 'var(--ym-success)', fontSize: '14px', '--ym-stagger-index': 2 }}>
          💡 正在孵化想法「{sourceIdea.title}」：作品发布后，该想法将自动点亮「已实现」并回链作品。
        </div>
      )}

      <form className="ym-create-form" onSubmit={handleSubmit}>
        {/* ========== ① 必填 ========== */}
        <div style={sectionHeaderStyle}>
          <span style={sectionNumStyle}>①</span>
          <span style={sectionTitleStyle}>必填内容</span>
          <span style={sectionHintStyle}>填好这些就能发布</span>
        </div>

        {/* 作品类型 */}
        <div className="ym-create-step ym-stagger-item" style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>作品类型</label>
          <div className="ym-create-type-options" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
            {partitions.length === 0 && (
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

        {/* 标题 */}
        <div className="ym-create-step ym-stagger-item" style={{ marginBottom: '16px' }}>
          <label htmlFor="create-title" style={labelStyle}>标题</label>
          <input
            id="create-title"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); clearFieldError('title'); }}
            placeholder={workType === 'website' ? '网站标题' : '作品标题'}
            required
            style={inputWithErr('title')}
          />
          {fieldErrors.title && <div style={fieldErrorStyle}>{fieldErrors.title}</div>}
        </div>

        {/* URL（仅网站类） */}
        {workType === 'website' && (
          <div className="ym-create-step ym-stagger-item" style={{ marginBottom: '16px' }}>
            <label htmlFor="create-url" style={labelStyle}>URL</label>
            <input
              id="create-url"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); clearFieldError('url'); }}
              placeholder="https://example.com"
              style={inputWithErr('url')}
            />
            {fieldErrors.url && <div style={fieldErrorStyle}>{fieldErrors.url}</div>}
          </div>
        )}

        {/* 描述 */}
        <div className="ym-create-step ym-stagger-item" style={{ marginBottom: '16px' }}>
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

        {/* AI 参与程度：合规必填，保留在主区 */}
        <div className="ym-create-step ym-stagger-item" style={{ marginBottom: '8px' }}>
          <label style={labelStyle}>AI 参与程度（必填，合规标识）</label>
          <ThemeSelect value={aiDegree} onChange={setAiDegree} ariaLabel="AI 参与程度" options={AI_DEGREES.map((d) => ({ value: d.id, label: d.label }))} />
          <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
            依据《人工智能生成合成内容标识办法》，AI 生成内容需显式+隐式标识；选「未知」时平台会加注风险提示。
          </div>
        </div>

        {/* ========== ② 推荐区 ========== */}
        <div style={sectionHeaderStyle}>
          <span style={sectionNumStyle}>②</span>
          <span style={sectionTitleStyle}>推荐完善</span>
          <span style={sectionHintStyle}>封面和标签能让作品被更多人看到</span>
        </div>

        {/* 图片上传 */}
        <div className="ym-create-step ym-stagger-item" style={{ marginBottom: '20px' }}>
          <label htmlFor="create-image" style={labelStyle}>{workType === 'website' ? '网站大图（可选）' : '作品图片（可选）'}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="ym-create-media-preview" style={{
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
                  不上传时，提交后将自动截取网站首页作为封面（异步，无需等待）
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px' }}>
                  支持 PNG/JPG/GIF/WebP，≤5MB
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 标签 */}
        <div className="ym-create-step ym-stagger-item" style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>标签（逗号分隔，最多 10 个，每个 ≤20 字）</label>
          <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="如：AI 工具, 开源, 效率" style={inputStyle} />
        </div>

        {/* 状态 / 可见性 / 分组 */}
        <div className="ym-create-step ym-stagger-item" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>创作状态</label>
            <ThemeSelect value={status} onChange={setStatus} ariaLabel="创作状态" options={[{ value: '', label: '未设置' }, ...WORK_STATUS.map((s) => ({ value: s.id, label: s.label }))]} />
          </div>
          <div>
            <label style={labelStyle}>可见性</label>
            <ThemeSelect value={visibility} onChange={setVisibility} ariaLabel="可见性" options={[{ value: 'public', label: '公开' }, { value: 'private', label: '私密' }]} />
          </div>
          <div>
            <label style={labelStyle}>分组（可选）</label>
            <ThemeSelect value={groupId} onChange={setGroupId} ariaLabel="分组" options={[{ value: '', label: '未分组' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
          </div>
        </div>

        {/* ========== ③ 高级选项（默认折叠） ========== */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            marginBottom: '16px',
            border: '1px dashed var(--ym-border-strong)',
            borderRadius: 'var(--ym-radius-sm)',
            backgroundColor: 'var(--ym-bg-subtle)',
            color: 'var(--ym-text-secondary)',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all var(--ym-transition)',
          }}
        >
          <span>{showAdvanced ? '▾ 高级选项' : '▸ 高级选项（演示视频 / 下载链接 / 版权与受众 / 更新日志 / 部署文件）'}</span>
          <span style={{ fontSize: '12px', color: 'var(--ym-text-muted)' }}>{showAdvanced ? '收起' : '展开'}</span>
        </button>

        {showAdvanced && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="create-video-url" style={labelStyle}>演示视频链接（可选）</label>
                <input
                  id="create-video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => { setVideoUrl(e.target.value); clearFieldError('videoUrl'); }}
                  placeholder="https://www.bilibili.com/video/BV..."
                  style={inputWithErr('videoUrl')}
                />
                {fieldErrors.videoUrl && <div style={fieldErrorStyle}>{fieldErrors.videoUrl}</div>}
                <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
                  详情页展示「观看演示视频」入口
                </div>
              </div>
              <div>
                <label htmlFor="create-download-url" style={labelStyle}>软件下载链接（可选）</label>
                <input
                  id="create-download-url"
                  type="url"
                  value={downloadUrl}
                  onChange={(e) => { setDownloadUrl(e.target.value); clearFieldError('downloadUrl'); }}
                  placeholder="https://...（安装包或下载页）"
                  style={inputWithErr('downloadUrl')}
                />
                {fieldErrors.downloadUrl && <div style={fieldErrorStyle}>{fieldErrors.downloadUrl}</div>}
                <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ym-text-muted)' }}>
                  详情页展示「⬇ 下载软件」入口
                </div>
              </div>
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

            <div style={{ marginBottom: '12px' }}>
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

            {/* 更新日志 */}
            <div style={{ marginBottom: '16px' }}>
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

            {/* Issue #13：拖拽上传静态网站（可选） */}
            <div
              style={{ marginBottom: '16px', padding: '18px', border: '2px dashed var(--ym-border)', borderRadius: 'var(--ym-radius-md)', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--ym-bg-subtle)', transition: 'border-color var(--ym-transition)' }}
              onClick={() => deployInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePickDeploy(f); }}
            >
              <input ref={deployInputRef} type='file' accept='.zip' style={{ display: 'none' }} onChange={(e) => handlePickDeploy(e.target.files?.[0])} />
              <div style={{ fontSize: '15px', color: 'var(--ym-text-secondary)' }}>📦 拖拽 zip 到此处，或点击选择（可选）</div>
              <div style={{ fontSize: '12px', color: 'var(--ym-text-muted)', marginTop: '4px', lineHeight: 1.6 }}>
                {deployFile ? `已选择：${deployFile.name}（创建成功后自动部署）` : "静态网站文件包 ≤50MB；仅支持纯静态站点（HTML/CSS/JS），不支持后端"}
              </div>
              {deployFile && (
                <button type='button' onClick={() => setDeployFile(null)} style={{ marginTop: '8px', padding: '4px 14px', border: '1px solid var(--ym-danger)', color: 'var(--ym-danger)', background: 'transparent', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                  移除文件
                </button>
              )}
              {deployMsg && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: deployMsg.startsWith('✅') ? 'var(--ym-success)' : 'var(--ym-danger)', wordBreak: 'break-all' }}>{deployMsg}</div>
              )}
            </div>
          </>
        )}

        {/* 消息 */}
        {message.text && (
          <div className="ym-create-message ym-stagger-item" style={{
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
          }}>
            {message.text}
          </div>
        )}

        {/* 提交按钮 */}
        <button
          className="ym-create-submit ym-stagger-item"
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: 'var(--ym-accent)',
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
              {uploading ? '上传图片中...' : '提交中...'}
            </>
          ) : '提交作品'}
        </button>
      </form>

      <div className="ym-create-return ym-stagger-item" style={{ marginTop: '16px', textAlign: 'center' }}>
        <Link to="/" style={{ color: 'var(--ym-text-secondary)', fontSize: '14px', textDecoration: 'none' }}>← 返回首页</Link>
      </div>
      </div>

      <aside className="ym-detail-side ym-create-aside ym-stagger-item" style={{ '--ym-stagger-index': 11 }}>
        <div className="ym-section-block">
          <h3 className="ym-section-title" style={{ margin: '0 0 12px' }}>提交提示</h3>
          <div style={{ fontSize: '13px', lineHeight: 1.8, color: 'var(--ym-text-secondary)' }}>
            <p>网站类作品必须填写完整 URL（含协议）。</p>
            <p>不上传大图时，提交后会自动截取首页作为封面，无需等待。</p>
            <p>私密作品只有自己可见，公开作品会展示在首页。</p>
            <p>演示视频、下载链接、版权信息等都在「高级选项」里。</p>
            <p>纯静态网站可以直接拖 zip 进「高级选项」自动部署。</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
