# 网站搜索（Issue #19）· 集成说明

> 独立文件已就绪（`src/services/search.js` / `src/components/SearchBar.jsx` / `src/styles/search.css`）。
> 集成只需要 **2 处小改动**（均在 `src/pages/HomePage.jsx`），按下面核对即可。

---

## 集成步骤

### 1. src/pages/HomePage.jsx — import（顶部）

在现有 import 区追加两行：

```js
import { SearchBar } from '../components/SearchBar.jsx';
import '../styles/search.css';
```

### 2. src/pages/HomePage.jsx — 挂载（建议位置）

在 `<HighRatedCarousel />` 之后、网站列表（`{loading ? ... : ...}` 网格）之前插入一行：

```jsx
<SearchBar />
```

效果：搜索栏显示在轮播下方、列表上方。输入关键词 → 250ms 防抖 → 下拉展示 Top8 结果（标题 / URL / 描述，命中词高亮，可键盘上下 + 回车 / 鼠标点击），点击跳转详情页。

### 3. 完成

不需要其他改动。`search.js` 已内置降级方案（视图失败自动回退 websites 表 + 手动点赞统计）。

---

## 可选定制

| 需求 | 方式 |
| --- | --- |
| 放顶部导航栏 | 把 `<SearchBar />` 移到 `<nav>` 内（样式已支持任意宽度） |
| 搜索时隐藏默认列表 | 在 HomePage 增加 `searching` state，把查询词传给 SearchBar 或本地过滤——v1 未做，需要可加 |
| 结果条数 | `<SearchBar />` 默认 8 条，改 `RESULT_LIMIT` 或传 `limit` 暂未开放，需要可加 prop |

## 验证

- 逻辑测试：`node search.test.js`（20 用例，纯逻辑零依赖）
- 构建：`npm run build` 通过
- 浏览器实测建议：搜标题关键词 / URL 片段 / 描述词各一组；空结果提示；移动端宽度

## 说明

- 搜索范围：标题 / URL / 描述（服务端 `ilike` 模糊匹配，客户端打分排序：标题 > URL > 描述，前缀加分，同分按点赞）
- LIKE 通配符（`%` `_`）已转义；查询长度上限 60 字符
- 高亮实现：先 `escapeHtml` 再注入 `<mark>`，**不会产生 XSS**（与 md_note 安全加固同思路）
