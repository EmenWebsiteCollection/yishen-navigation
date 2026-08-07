# 手机端 UI 适配（Issue #9）实现说明

## 需求对照

| Issue 需求 | 实现方式 |
| --- | --- |
| 自动检测用户当前设备类型 | `src/hooks/useDevice.js`：基于 `matchMedia` 检测 mobile(≤640px) / tablet(641-1024px) / desktop(>1024px)，自动同步 `<html data-device>`；`main.jsx` 在首帧渲染前完成检测，避免闪跳 |
| 手机端自动切换移动端 UI 布局 | `src/styles/responsive.css`：移动端断点（≤640px）自动生效，无需手动切换 |
| 支持不同屏幕尺寸的自适应布局 | 三档断点：mobile ≤640px / tablet 641-1024px / desktop >1024px |
| 评论区反馈：切换后停留在页面底端 | `src/components/ScrollToTop.jsx`：路由切换后自动回到页面顶端（App.jsx 已挂载） |

## 移动端适配内容

- 顶部导航：收紧内边距，按钮加大点击区（min-height 40px）
- 网站卡片网格：移动端强制单列（`grid-template-columns: 1fr`），窄屏更易读
- 卡片：触摸设备屏蔽 hover 上浮效果，改为按压缩放反馈（:active）
- 分页：按钮点击区放大到 44×44px（移动端触控标准）
- 详情/创建/编辑页：容器贴边、收紧留白（16px），标题字号下调
- 输入框/文本域：字号提到 16px，避免 iOS 聚焦自动放大页面
- 轮播：箭头 44px、圆点加大，触控更友好
- 主题切换悬浮球：适配 iPhone 刘海屏安全区（env(safe-area-inset-*)）
- 全局：去掉移动端点击高亮、双击缩放延迟（touch-action: manipulation）

## 涉及文件

新增：
- `src/hooks/useDevice.js`
- `src/components/ScrollToTop.jsx`
- `src/styles/responsive.css`

修改：
- `index.html`（viewport 增加 viewport-fit=cover）
- `src/main.jsx`（预检测设备 + 引入 responsive.css）
- `src/App.jsx`（挂载 ScrollToTop + useDevice）
- `src/pages/HomePage.jsx`（新增 ym-nav/ym-grid/ym-card/ym-pagination/ym-modal-card 等语义类）
- `src/pages/WebsiteDetailPage.jsx`（ym-page-card / ym-detail-actions）
- `src/pages/CreateWebsitePage.jsx`、`src/pages/EditWebsitePage.jsx`（ym-page-card）
- `src/components/ThemeSwitcher.jsx`（ym-fab）

## 验证

- `npm run build` 通过（vite 96 modules，无报错）
- 后续可在浏览器 DevTools 设备模拟（iPhone SE 375px / iPad 768px / 桌面 1280px）逐页检查

## 备注

- 页面主体样式为内联样式，移动端覆盖使用 `!important`，仅覆盖随屏幕变化的属性，桌面端不受影响
- 断点数值与 `useDevice.js`、`responsive.css` 保持同源，如需调整请两处同步修改
