// src/services/regression-163-164.test.js
// 回归测试：锁定 #163（投稿表单为所有作品类型开放 URL 栏）与 #164（灵感发布后作者可编辑分类/标签）
// 在逻辑层确实存在的行为，避免后续改动无意中破坏。运行：npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTags, validateIdeaInput, IDEA_CATEGORIES } from './idea-logic.js';

// ---------- #164：作者可编辑标签 ----------
// 编辑标签复用的 normalizeTags 必须幂等：编辑后再归一化结果一致
test('#164 normalizeTags 幂等（编辑标签后再归一化结果一致）', () => {
  const edited = 'AI, ai, 插画, 插画, ' + 't'.repeat(21); // 含重复 + 超长
  const once = normalizeTags(edited);
  assert.deepEqual(normalizeTags(once.join(',')), once);
});

// 作者把标签改成超 10 个时应被截断到 10
test('#164 编辑标签超过 10 个时截断', () => {
  const many = Array.from({ length: 15 }, (_, i) => 'tag' + i).join(',');
  assert.equal(normalizeTags(many).length, 10);
});

// ---------- #163 / #160：投稿对所有类型开放 URL 栏 ----------
// 携带 url 的非网站类投稿不应因 url 字段被校验拒绝
test('#163 携带 url 的非网站类投稿通过校验', () => {
  const errors = validateIdeaInput({
    title: '我的写作项目',
    category: 'writing',
    description: '一个公开连载',
    tags: ['小说'],
    url: 'https://example.com/serial',
  });
  assert.equal(errors.length, 0);
});

// 即便 url 为空，只要标题/分类合法也应通过（URL 非必填，且不应阻碍任意分类提交）
test('#163 url 为空不影响任意分类提交', () => {
  for (const c of IDEA_CATEGORIES) {
    const errors = validateIdeaInput({ title: '示例', category: c.id, tags: [] });
    assert.ok(!errors.some((e) => e.includes('URL') || e.includes('链接')));
  }
});

// ---------- #164：作者可编辑分类，但必须仍是合法分类 ----------
test('#164 编辑后分类非法仍被校验拦截', () => {
  const errors = validateIdeaInput({ title: 'x', category: 'not_a_category', tags: [] });
  assert.ok(errors.some((e) => e.includes('分类')));
});
