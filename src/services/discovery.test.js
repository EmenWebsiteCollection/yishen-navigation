// src/services/discovery.test.js
// Issue #39 P1 纯逻辑单测（Node 直跑）：node src/services/discovery.test.js
import assert from 'node:assert';
import { test } from 'node:test';
import {
  normalizeTagList,
  wilsonLowerBound,
  overlapScore,
  dedupeByAuthor,
  excludeSeen,
  sortRailFallback,
  passesRandomGate,
  DISCOVERY_RAILS,
} from './discovery-logic.js';

const ok = (name, fn) => test(name, fn);

// ---------- normalizeTagList ----------
ok('标签清洗：去空、去重（忽略大小写）、限长', () => {
  const out = normalizeTagList(['  AI ', 'ai', '   ', '奇幻', 'AI'], { max: 10, maxLen: 20 });
  assert.deepStrictEqual(out, ['AI', '奇幻']);
});
ok('标签清洗：超过 max 截断', () => {
  const out = normalizeTagList(['a', 'b', 'c'], { max: 2 });
  assert.deepStrictEqual(out, ['a', 'b']);
});
ok('标签清洗：超长抛错', () => {
  assert.throws(() => normalizeTagList(['一二三四五六七八九十一二三四五六七八九十一二'], { maxLen: 20 }));
});
ok('标签清洗：非数组返回空', () => {
  assert.deepStrictEqual(normalizeTagList(null), []);
  assert.deepStrictEqual(normalizeTagList(undefined), []);
});

// ---------- wilsonLowerBound ----------
ok('Wilson 下界：0 样本为 0', () => {
  assert.strictEqual(wilsonLowerBound(0, 0), 0);
});
ok('Wilson 下界：高比例高置信高于低比例', () => {
  const a = wilsonLowerBound(90, 100);
  const b = wilsonLowerBound(9, 100);
  assert.ok(a > b);
});
ok('Wilson 下界：小样本被惩罚（1/1 低于 90/100）', () => {
  const small = wilsonLowerBound(1, 1);
  const big = wilsonLowerBound(90, 100);
  assert.ok(small < big);
});

// ---------- overlapScore ----------
ok('重叠打分：标签/风格/工具/类型加权', () => {
  const work = { tags: ['AI', '奇幻'], styles: ['像素'], tools: ['PS'], work_type: 'game' };
  const seed = { tags: ['AI'], styles: ['像素'], tools: ['Aseprite'], work_type: 'game' };
  assert.strictEqual(overlapScore(work, seed), 2 + 2 + 0 + 1);
});
ok('重叠打分：无重叠为 0', () => {
  assert.strictEqual(overlapScore({ tags: ['x'], work_type: 'novel' }, { tags: ['y'], work_type: 'game' }), 0);
});

// ---------- dedupeByAuthor ----------
ok('作者去重：每人最多 2 个，总量限 limit', () => {
  const list = [
    { id: '1', user_id: 'u1' }, { id: '2', user_id: 'u1' }, { id: '3', user_id: 'u1' },
    { id: '4', user_id: 'u2' }, { id: '5', user_id: 'u2' }, { id: '6', user_id: 'u3' },
  ];
  const out = dedupeByAuthor(list, { maxPerAuthor: 2, limit: 12 });
  assert.deepStrictEqual(out.map((w) => w.id), ['1', '2', '4', '5', '6']);
});
ok('作者去重：limit 生效', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ id: String(i), user_id: `u${i % 3}` }));
  const out = dedupeByAuthor(list, { maxPerAuthor: 1, limit: 3 });
  assert.strictEqual(out.length, 3);
});

// ---------- excludeSeen ----------
ok('已看去重', () => {
  const list = [{ id: 'a' }, { id: 'b' }];
  assert.deepStrictEqual(excludeSeen(list, ['a']), [{ id: 'b' }]);
});

// ---------- sortRailFallback ----------
ok('降级排序：latest 按时间倒序', () => {
  const list = [
    { id: 'a', created_at: '2026-01-01', like_count: 9, favorite_count: 0, comment_count: 0 },
    { id: 'b', created_at: '2026-02-01', like_count: 1, favorite_count: 0, comment_count: 0 },
  ];
  assert.deepStrictEqual(sortRailFallback(list, 'latest').map((w) => w.id), ['b', 'a']);
});
ok('降级排序：zero_comment 过滤且有赞优先', () => {
  const list = [
    { id: 'a', like_count: 0, comment_count: 1 },
    { id: 'b', like_count: 5, comment_count: 0 },
    { id: 'c', like_count: 2, comment_count: 0 },
  ];
  assert.deepStrictEqual(sortRailFallback(list, 'zero_comment').map((w) => w.id), ['b', 'c']);
});

// ---------- passesRandomGate ----------
ok('随机质量门槛：0 赞且非精选不过', () => {
  assert.strictEqual(passesRandomGate({ like_count: 0, featured: false }), false);
});
ok('随机质量门槛：有赞或精选通过', () => {
  assert.strictEqual(passesRandomGate({ like_count: 1, featured: false }), true);
  assert.strictEqual(passesRandomGate({ like_count: 0, featured: true }), true);
});
ok('随机质量门槛：空对象不过', () => {
  assert.strictEqual(passesRandomGate(null), false);
});

// ---------- 常量完整性 ----------
ok('rails 常量包含 Issue 要求的核心入口', () => {
  const ids = DISCOVERY_RAILS.map((r) => r.id);
  for (const need of ['latest', 'rising', 'featured', 'underrated', 'growing', 'zero_comment', 'following', 'favorites']) {
    assert.ok(ids.includes(need), `缺少 rail: ${need}`);
  }
});

if (process.exitCode) process.exit(process.exitCode);
