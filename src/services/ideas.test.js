// src/services/ideas.test.js
// Issue #12 纯逻辑测试（零依赖，Node 直跑）：node src/services/ideas.test.js
import assert from 'node:assert';
import { test } from 'node:test';
import {
  normalizeTags,
  validateIdeaInput,
  checkIdeaRateLimit,
  rankSimilarIdeas,
  ideaCategoryLabel,
  ideaStatusLabel,
  validateIdeaLinkable,
  shouldMarkImplemented,
} from './idea-logic.js';

const ok = (name, fn) => test(name, fn);

// ---------- normalizeTags ----------
ok('normalizeTags: 中英文逗号/顿号/换行分隔', () => {
  assert.deepStrictEqual(normalizeTags('a，b、c\nd, e'), ['a', 'b', 'c', 'd', 'e']);
});
ok('normalizeTags: 大小写去重', () => {
  assert.deepStrictEqual(normalizeTags('ai, AI, ai'), ['ai', 'AI']);
});
ok('normalizeTags: 上限 10 个', () => {
  const tags = Array.from({ length: 15 }, (_, i) => 't' + i).join(',');
  assert.strictEqual(normalizeTags(tags).length, 10);
});
ok('normalizeTags: 单个超过 20 字被忽略', () => {
  assert.deepStrictEqual(normalizeTags('x'.repeat(21) + ', ok'), ['ok']);
});

// ---------- validateIdeaInput ----------
ok('validate: 空标题报错', () => {
  assert.ok(
    validateIdeaInput({ title: ' ', category: 'website' }).some((e) => e.includes('标题'))
  );
});
ok('validate: 标题超 80 字报错', () => {
  assert.ok(
    validateIdeaInput({ title: 'x'.repeat(81), category: 'website' }).some((e) => e.includes('80'))
  );
});
ok('validate: 描述超 2000 字报错', () => {
  assert.ok(
    validateIdeaInput({ title: 't', description: 'y'.repeat(2001), category: 'website' }).some(
      (e) => e.includes('2000')
    )
  );
});
ok('validate: 描述换行超 50 报错', () => {
  assert.ok(
    validateIdeaInput({ title: 't', description: 'a' + '\n'.repeat(51) + 'b', category: 'website' }).some(
      (e) => e.includes('换行')
    )
  );
});
ok('validate: 非法分类报错', () => {
  assert.ok(
    validateIdeaInput({ title: 't', category: 'nope' }).some((e) => e.includes('分类'))
  );
});
ok('validate: 标签超过 10 个报错', () => {
  assert.ok(
    validateIdeaInput({
      title: 't',
      category: 'website',
      tags: Array.from({ length: 11 }, (_, i) => 't' + i),
    }).some((e) => e.includes('10'))
  );
});
ok('validate: 单个标签超 20 字报错', () => {
  assert.ok(
    validateIdeaInput({ title: 't', category: 'website', tags: ['x'.repeat(21)] }).some(
      (e) => e.includes('20')
    )
  );
});
ok('validate: 合法输入无错误', () => {
  assert.deepStrictEqual(
    validateIdeaInput({ title: '测试想法', category: 'website', tags: ['a', 'b'] }),
    []
  );
});

// ---------- checkIdeaRateLimit ----------
ok('rate: 1h 内 3 条触发', () => {
  assert.ok(checkIdeaRateLimit(3, 5));
});
ok('rate: 24h 内 10 条触发', () => {
  assert.ok(checkIdeaRateLimit(0, 10));
});
ok('rate: 未超限返回 null', () => {
  assert.strictEqual(checkIdeaRateLimit(2, 9), null);
});

// ---------- rankSimilarIdeas ----------
ok('rank: 标题命中优先于描述命中', () => {
  const ideas = [
    { id: 'a', title: '搜索功能', description: 'xxx', tags: [], created_at: '2026-01-01' },
    { id: 'b', title: '其他', description: '搜索相关描述', tags: [], created_at: '2026-01-02' },
  ];
  const r = rankSimilarIdeas(ideas, '搜索');
  assert.strictEqual(r[0].id, 'a');
  assert.strictEqual(r.length, 2);
});
ok('rank: 前缀命中加分更高', () => {
  const ideas = [
    { id: 'a', title: '创作者匹配', description: '', tags: [], created_at: '2026-01-01' },
    { id: 'b', title: '我想要创作者匹配功能', description: '', tags: [], created_at: '2026-01-02' },
  ];
  const r = rankSimilarIdeas(ideas, '创作者匹配');
  assert.strictEqual(r[0].id, 'a');
});
ok('rank: 空查询返回空数组', () => {
  assert.deepStrictEqual(rankSimilarIdeas([{ title: 'x' }], '   '), []);
});
ok('rank: 无命中返回空数组', () => {
  assert.deepStrictEqual(rankSimilarIdeas([{ title: 'x' }], '完全无关'), []);
});

// ---------- 标签映射 ----------
ok('label: 分类/状态映射', () => {
  assert.strictEqual(ideaCategoryLabel('website'), '网站');
  assert.strictEqual(ideaStatusLabel('done'), '已实现');
  assert.strictEqual(ideaCategoryLabel('不存在'), '不存在');
});

// ---------- 孵化闭环判定（T3b） ----------
ok('linkable: 未绑定想法允许关联', () => {
  assert.deepStrictEqual(validateIdeaLinkable({ related_work_id: null, status: 'developing' }), []);
});
ok('linkable: 已绑定 related_work_id 拒绝（防重复）', () => {
  const errs = validateIdeaLinkable({ related_work_id: 'work-123', status: 'developing' });
  assert.ok(errs.length > 0 && errs[0].includes('已实现'));
});
ok('linkable: 已关闭想法拒绝关联', () => {
  const errs = validateIdeaLinkable({ related_work_id: null, status: 'closed' });
  assert.ok(errs.some((e) => e.includes('已关闭')));
});
ok('linkable: 空参数不抛错（容错）', () => {
  assert.deepStrictEqual(validateIdeaLinkable(), []);
});
ok('shouldMarkImplemented: 公开作品且未 done → 点亮', () => {
  assert.strictEqual(shouldMarkImplemented('developing', 'public'), true);
});
ok('shouldMarkImplemented: 私密作品不点亮（保留关联）', () => {
  assert.strictEqual(shouldMarkImplemented('developing', 'private'), false);
});
ok('shouldMarkImplemented: 已 done 不重复点亮', () => {
  assert.strictEqual(shouldMarkImplemented('done', 'public'), false);
});

