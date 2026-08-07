# 手机端 UI 适配 · 集成说明

> 独立文件已就绪（`src/hooks/useDevice.js` / `src/components/ScrollToTop.jsx` / `src/styles/responsive.css`）。
> 以下是在**原有文件**中需要添加的挂载点，按文件逐条核对即可。
> 基于当前 main（含「回复评论」更新）核对。

---

## 1. index.html

`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
→ 追加 `, viewport-fit=cover`（刘海屏安全区，配合悬浮球适配）：
`content="width=device-width, initial-scale=1.0, viewport-fit=cover"`

---

## 2. src/main.jsx

- `import './styles/global.css';` 之后加一行：
  `import './styles/responsive.css';`
- （可选，防首帧闪跳）在 `ReactDOM.createRoot(...)` 之前加设备预检测：
  ```js
  try {
    const mqMobile = window.matchMedia('(max-width: 640px)');
    const mqTablet = window.matchMedia('(min-width: 641px) and (max-width: 1024px)');
    document.documentElement.setAttribute(
      'data-device',
      mqMobile.matches ? 'mobile' : mqTablet.matches ? 'tablet' : 'desktop'
    );
  } catch (e) {
    document.documentElement.setAttribute('data-device', 'desktop');
  }
  ```

---

## 3. src/App.jsx

- import 区加两行：
  ```js
  import { useDevice } from './hooks/useDevice.js';
  import { ScrollToTop } from './components/ScrollToTop.jsx';
  ```
- `function App()` 内、`return` 前加：
  ```js
  useDevice();
  ```
- `return` 的 Fragment 内、`<ThemeSwitcher />` 之前加：
  ```jsx
  <ScrollToTop />
  ```

---

## 4. src/pages/HomePage.jsx

按锚点给对应元素加 `className`（保留原有内联样式）：

| 元素锚点 | 添加的 className |
| --- | --- |
| `<nav style={{ padding: '16px 24px', ... }}` | `ym-nav` |
| 右侧操作区 `<div style={{ display: 'flex', gap: '12px', ... }}`（含 登录/注册/提交按钮） | `ym-nav-actions` |
| 用户名 `<span style={{ fontSize: '14px', ... }}>👤 ...` | `ym-nav-username` |
| 主内容容器 `<div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px 40px' }}` | `ym-container` |
| 骨架屏网格 `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>`（loading 分支） | `ym-grid` |
| 网站卡片网格（同上样式，websites.map 外层） | `ym-grid` |
| 卡片 `<div key={site.id} onClick={...} style={{ border: '1px solid var(--ym-border)', borderRadius: 'var(--ym-radius-md)', ... }}` | `ym-card` |
| 分页容器 `<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '32px', ... }}>` | `ym-pagination` |
| 登录弹窗内层卡片 `<div className={modalClosing ? 'ym-scale-out' : 'ym-scale-in'} ...>` | 追加 `ym-modal-card`（如 `ym-modal-card ym-scale-in`） |
| 注册弹窗内层卡片（同上） | 追加 `ym-modal-card` |

---

## 5. src/pages/WebsiteDetailPage.jsx

⚠️ 该文件在「回复评论」提交中已更新，以下锚点基于当前版本核对：

| 元素锚点 | 添加的 className |
| --- | --- |
| 错误态容器 `<div style={{ maxWidth: '560px', margin: '60px auto', padding: '32px 28px', ... textAlign: 'center' }}>` | `ym-page-card` |
| 「网站不存在」容器（同上结构） | `ym-page-card` |
| 主内容容器 `<div style={{ maxWidth: '720px', margin: '40px auto', padding: '32px 28px', ... boxShadow: '0 4px 16px ...' }}>` | `ym-page-card` |
| 底部操作区 `<div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '32px', borderTop: '1px solid var(--ym-border)', paddingTop: '24px' }}>`（含 编辑/删除） | `ym-detail-actions` |

---

## 6. src/pages/CreateWebsitePage.jsx

| 元素锚点 | className |
| --- | --- |
| 主容器 `<div style={{ maxWidth: '560px', margin: '60px auto', padding: '32px 28px', ... boxShadow: '0 4px 16px ...' }}>` | `ym-page-card` |

---

## 7. src/pages/EditWebsitePage.jsx

| 元素锚点 | className |
| --- | --- |
| 错误态容器（maxWidth 560px + textAlign center） | `ym-page-card` |
| 主容器（maxWidth 560px + boxShadow） | `ym-page-card` |

---

## 8. src/components/ThemeSwitcher.jsx

| 元素锚点 | className |
| --- | --- |
| 根节点 `<div ref={rootRef} style={{ position: 'fixed', right: '20px', bottom: '20px', zIndex: 1001 }}>` | `ym-fab` |

---

## 集成检查清单

- [ ] 4 个新文件已合入（useDevice.js / ScrollToTop.jsx / responsive.css / 本说明）
- [ ] 上述 8 个原文件挂载点已添加
- [ ] `npm run build` 通过
- [ ] DevTools 设备模拟抽查：375px（单列卡片、分页点击区）、768px、桌面

## 断点约定

mobile ≤640px ｜ tablet 641-1024px ｜ desktop >1024px（`useDevice.js` 与 `responsive.css` 两处同源）
