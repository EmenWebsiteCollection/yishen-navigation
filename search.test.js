// search.test.js — 搜索逻辑测试（Issue #19）
// 运行：node search.test.js（仓库 package.json 为 "type": "module"，直接 ESM）
import { normalizeQuery, rankWebsites, highlightHtml, escapeHtml } from './src/services/search.js';

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

const SITES = [
  { id: 1, title: 'GitHub', url: 'https://github.com', description: '代码托管平台', like_count: 100, username: 'octocat', tags: ['开发', '工具'] },
  { id: 2, title: '问天AI', url: 'https://wentian.example.com', description: '人生咨询智慧引擎', like_count: 200, username: 'wentian', tags: ['AI', '问答'] },
  { id: 3, title: '码云 Gitee', url: 'https://gitee.com', description: '国内代码托管', like_count: 50, username: '码云官方', tags: ['开发', '效率'] },
  { id: 4, title: 'B站', url: 'https://bilibili.com', description: '视频弹幕网站', like_count: 300, username: 'bili', tags: ['视频', '娱乐'] },
];

console.log('== normalizeQuery ==');
t('去除首尾空格', normalizeQuery('  hello  ') === 'hello');
t('合并连续空格', normalizeQuery('a  b   c') === 'a b c');
t('空输入', normalizeQuery('') === '');
t('null 输入', normalizeQuery(null) === '');
t('超长截断', normalizeQuery('x'.repeat(100)).length === 60);

console.log('== rankWebsites ==');
t('标题命中优先于描述命中', rankWebsites(SITES, 'github')[0].id === 1);
t('标题前缀命中加分（git 命中 GitHub 而非 Gitee 靠前缀）', rankWebsites(SITES, 'git')[0].id === 1);
t('URL 命中', rankWebsites(SITES, 'bilibili.com')[0].id === 4);
t('描述命中', rankWebsites(SITES, '智慧引擎')[0].id === 2);
t('无命中返回空数组', rankWebsites(SITES, '不存在的东西').length === 0);
t('空查询返回空数组', rankWebsites(SITES, '').length === 0);
t('同分按点赞数排序', rankWebsites([{ id: 9, title: 'Aa', like_count: 1 }, { id: 8, title: 'Aa', like_count: 9 }], 'aa')[0].id === 8);
t('大小写不敏感', rankWebsites(SITES, 'GITHUB')[0].id === 1);

console.log('== rankWebsites: username / tags（多字段扩展） ==');
t('作者名命中（username 包含）', rankWebsites(SITES, 'octocat')[0].id === 1);
t('作者名前缀命中优先于包含', rankWebsites([{ id: 1, title: 'X', username: 'github' }, { id: 2, title: 'Y', username: 'mygithub' }], 'github')[0].id === 1);
t('标签命中（tags 任一元素包含）', rankWebsites(SITES, '效率')[0].id === 3);
t('标签大小写不敏感', rankWebsites(SITES, 'AI')[0].id === 2);
t('作者 + 标签综合：作者优先于标签', rankWebsites([{ id: 1, title: 'X', username: '效率王', tags: [] }, { id: 2, title: 'Y', username: 'zzz', tags: ['效率'] }], '效率')[0].id === 1);
t('tags 字段缺失不报错', rankWebsites([{ id: 9, title: 'Aa', like_count: 1 }, { id: 8, title: 'Ab', like_count: 9 }], 'aa')[0].id === 9);
t('username 字段缺失不报错', rankWebsites([{ id: 9, title: 'Aa', like_count: 1 }, { id: 8, title: 'Ab', like_count: 9 }], 'aa')[0].id === 9);

console.log('== highlightHtml ==');
t('命中包 mark', highlightHtml('GitHub 代码托管', 'github') === '<mark class="ym-search-hl">GitHub</mark> 代码托管');
t('无命中原样转义', highlightHtml('hello <b>world</b>', 'xyz') === 'hello &lt;b&gt;world&lt;/b&gt;');
t('转义在前：script 不执行', !highlightHtml('<img src=x onerror=alert(1)>', 'img').includes('<img'));
t('命中词本身被转义后再包 mark', highlightHtml('<b>git</b>', 'git') === '&lt;b&gt;<mark class="ym-search-hl">git</mark>&lt;/b&gt;');
t('空文本', highlightHtml('', 'a') === '');
t('空查询', highlightHtml('abc', '') === 'abc');

console.log('== escapeHtml ==');
t('五字符全转义', escapeHtml('<a href="x">&</a>') === '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
