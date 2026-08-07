# 手机端 UI 适配（Issue #9）· 独立文件交付

> 交付方式（按团队要求）：**仅新增独立文件，不修改任何原有文件**。
> 挂载步骤见 `docs/mobile-ui-integration.md`，由团队开发者合入。

## 交付文件

| 文件 | 作用 |
| --- | --- |
| `src/hooks/useDevice.js` | 设备检测 Hook：mobile(≤640px) / tablet(641-1024px) / desktop(>1024px)，同步 `<html data-device>` |
| `src/components/ScrollToTop.jsx` | 路由切换后自动回到页面顶端（修复评论区反馈的「停留在底端」） |
| `src/styles/responsive.css` | 移动端断点样式层（≤640px 自动生效，不依赖手动切换） |
| `docs/mobile-ui-integration.md` | 集成说明：需要在原文件中添加的挂载点清单 |

## 需求对照

| Issue 需求 | 实现 |
| --- | --- |
| 自动检测用户当前设备类型 | `useDevice.js`，`main.jsx` 首帧前预检测防闪跳 |
| 手机端自动切换移动端 UI 布局 | `responsive.css`，移动端断点自动生效 |
| 支持不同屏幕尺寸的自适应布局 | 三档断点：mobile / tablet / desktop |
| 评论区反馈：切换后停留在页面底端 | `ScrollToTop.jsx` |

## 移动端适配内容

- 顶部导航：收紧内边距，按钮点击区 ≥40px
- 网站卡片网格：移动端强制单列
- 卡片：触摸设备屏蔽 hover 上浮，改为按压缩放反馈
- 分页：按钮点击区 44×44px（触控标准）
- 详情/创建/编辑页：容器贴边收紧留白，标题字号下调
- 输入框/文本域：字号 16px，避免 iOS 聚焦自动放大
- 轮播：箭头/圆点加大；主题悬浮球适配刘海屏安全区
- 全局：去掉点击高亮、双击缩放延迟；键盘可达性焦点轮廓

## 验证

- 独立文件本身语法正确（构建不引用时不影响原有功能）
- 集成完成后建议 `npm run build` + DevTools 设备模拟检查（iPhone SE 375px / iPad 768px / 桌面 ≥1025px）

## 备注

- 断点数值在 `useDevice.js` 与 `responsive.css` 两处保持一致，调整需同步修改
- 页面主体为内联样式，移动端覆盖使用 `!important`，仅覆盖随屏幕变化的属性，桌面端不受影响
