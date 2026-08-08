// src/services/comment-logic.test.js
// Issue #39 P2 纯逻辑单测：node src/services/comment-logic.test.js
import assert from 'node:assert';
import {
  FEEDBACK_TYPES,
  validateFeedbackType,
  validateCommentContent,
  validateAnchor,
  checkTextQuoteMismatch,
  formatTime,
} from './comment-logic.js';

let passed = 0;
const ok = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '->', e.message);
    process.exitCode = 1;
  }
};

// ---------- 反馈类型 ----------
ok('反馈类型：8 种齐全', () => {
  assert.deepStrictEqual(FEEDBACK_TYPES.map((f) => f.id), [
    'appreciate', 'suggestion', 'technical', 'plot', 'style', 'error', 'collab', 'consult',
  ]);
});
ok('反馈类型：默认 appreciate，未知抛错', () => {
  assert.strictEqual(validateFeedbackType(undefined), 'appreciate');
  assert.throws(() => validateFeedbackType('xxx'));
});

// ---------- 评论内容 ----------
ok('评论内容：trim 后非空', () => {
  assert.strictEqual(validateCommentContent('  你好  '), '你好');
  assert.throws(() => validateCommentContent('   '));
});
ok('评论内容：超 1000 字抛错', () => {
  assert.throws(() => validateCommentContent('a'.repeat(1001)));
  assert.strictEqual(validateCommentContent('a'.repeat(1000)).length, 1000);
});
ok('评论内容：换行超 10 抛错', () => {
  assert.throws(() => validateCommentContent('a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl'));
  assert.ok(validateCommentContent('a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk'));
});

// ---------- 批注锚点 ----------
ok('锚点：null/空返回 null', () => {
  assert.strictEqual(validateAnchor(null), null);
  assert.strictEqual(validateAnchor(''), null);
});
ok('锚点：image 归一化坐标校验', () => {
  assert.deepStrictEqual(validateAnchor({ kind: 'image', x: 0.1, y: 0.2, w: 0.3, h: 0.4 }), { kind: 'image', x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.throws(() => validateAnchor({ kind: 'image', x: 1.5, y: 0.2, w: 0.3, h: 0.4 }));
  assert.throws(() => validateAnchor({ kind: 'image', x: 0.1, y: 0.2, w: 0, h: 0.4 }));
});
ok('锚点：text 位置与 quote 长度', () => {
  assert.deepStrictEqual(validateAnchor({ kind: 'text', start: 2, end: 5, quote: 'abc' }), { kind: 'text', start: 2, end: 5, quote: 'abc' });
  assert.throws(() => validateAnchor({ kind: 'text', start: 5, end: 2, quote: 'x' }));
  assert.throws(() => validateAnchor({ kind: 'text', start: -1, end: 2, quote: 'x' }));
});
ok('锚点：video/audio 时间区间', () => {
  assert.deepStrictEqual(validateAnchor({ kind: 'video', start_sec: 90, end_sec: 120 }), { kind: 'video', start_sec: 90, end_sec: 120 });
  assert.deepStrictEqual(validateAnchor({ kind: 'audio', start_sec: 30 }), { kind: 'audio', start_sec: 30 });
  assert.throws(() => validateAnchor({ kind: 'video', start_sec: 120, end_sec: 90 }));
  assert.throws(() => validateAnchor({ kind: 'video', start_sec: -1 }));
});
ok('锚点：component path', () => {
  assert.deepStrictEqual(validateAnchor({ kind: 'component', path: '#desc > p' }), { kind: 'component', path: '#desc > p' });
  assert.throws(() => validateAnchor({ kind: 'component', path: '  ' }));
});
ok('锚点：未知类型抛错', () => {
  assert.throws(() => validateAnchor({ kind: 'foo' }));
});

// ---------- 文本失配 ----------
ok('文本失配：改版后提示', () => {
  assert.strictEqual(checkTextQuoteMismatch({ kind: 'text', start: 0, end: 3, quote: 'abc' }, 'xyzdef'), true);
  assert.strictEqual(checkTextQuoteMismatch({ kind: 'text', start: 0, end: 3, quote: 'abc' }, 'abcdef'), false);
  assert.strictEqual(checkTextQuoteMismatch(null, 'abc'), false);
});

// ---------- 时间格式化 ----------
ok('时间格式化 mm:ss', () => {
  assert.strictEqual(formatTime(0), '00:00');
  assert.strictEqual(formatTime(90), '01:30');
  assert.strictEqual(formatTime(3600), '60:00');
});

console.log(`\n${passed} 组断言通过`);
if (process.exitCode) process.exit(process.exitCode);
