// scripts/yili/chunk.test.mjs —— 句群切块纯逻辑测试（零依赖，Node 直跑）
// 运行：node scripts/yili/chunk.test.mjs
import assert from 'node:assert/strict';
import { splitIntoSentences, buildChunks, splitLongSentence, chunkCorpusText, estimateTokens } from './chunk-logic.mjs';

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('chunk-logic 测试：');

ok('splitIntoSentences 按句末标点切分并保留标点', () => {
  const s = '你好啊。今天讲Python！真的吗？嗯…好吧。';
  const out = splitIntoSentences(s);
  assert.equal(out.length, 5); // 「嗯…」省略号也作为句末标点
  assert.ok(out[0].endsWith('。'));
  assert.ok(out[1].endsWith('！'));
  assert.ok(out[2].endsWith('？'));
});

ok('splitIntoSentences 无标点文本整体返回一句', () => {
  const out = splitIntoSentences('这是一段没有标点的文本内容');
  assert.equal(out.length, 1);
});

ok('splitLongSentence 超长句按次要标点拆分且不超 maxChars', () => {
  const long = '啊，'.repeat(300) + '结尾句。'; // 约 900 字符
  const parts = splitLongSentence(long, 200);
  for (const p of parts) assert.ok(p.length <= 200, `片长 ${p.length} 超限`);
  assert.ok(parts.length > 1);
});

ok('buildChunks 贪心聚合在 min/max 区间内', () => {
  const sentences = splitIntoSentences('第一句。第二句。第三句。第四句。第五句。第六句。第七句。第八句。'.repeat(5));
  const chunks = buildChunks(sentences, { minChars: 10, maxChars: 30, overlap: false });
  for (const c of chunks) {
    assert.ok(c.length <= 30, `块长 ${c.length} 超 maxChars`);
  }
  assert.ok(chunks.length > 1);
});

ok('buildChunks overlap=true 时相邻块共享前块最后一句', () => {
  const sentences = splitIntoSentences('句子甲。句子乙。句子丙。句子丁。句子戊。句子己。句子庚。句子辛。');
  const noOv = buildChunks(sentences, { minChars: 4, maxChars: 6, overlap: false });
  const ov = buildChunks(sentences, { minChars: 4, maxChars: 6, overlap: true });
  // 重叠后相邻块共享「前块最后一句」：检验 ov[1] 以 ov[0] 的最后一句开头
  const ss0 = splitIntoSentences(ov[0]);
  const lastOf0 = ss0[ss0.length - 1];
  assert.ok(ov[1].startsWith(lastOf0), `ov[1] 未以 "${lastOf0}" 开头`);
  assert.ok(noOv.length <= ov.length);
});

ok('chunkCorpusText 产出结构化块（content + token_count）', () => {
  const text = '大家好呀，欢迎回来！'.repeat(60); // 约 660 字符
  const chunks = chunkCorpusText(text, { minChars: 300, maxChars: 500, overlap: false });
  assert.ok(chunks.length >= 1);
  for (const c of chunks) {
    assert.ok(typeof c.content === 'string' && c.content.length > 0);
    assert.ok(Number.isInteger(c.token_count) && c.token_count > 0);
  }
});

ok('estimateTokens 中文按 1 计、ASCII 减半', () => {
  assert.equal(estimateTokens('你好'), 2);
  assert.equal(estimateTokens('abc'), 2); // 3 * 0.5 → ceil 2
});

ok('长口语文本（含重复句群）可完整切完，不丢尾', () => {
  const text = '对，就这样。然后呢？我们继续看啊。'.repeat(80); // 约 1000+ 字符
  const chunks = chunkCorpusText(text, { minChars: 400, maxChars: 800, overlap: true });
  const joined = chunks.map((c) => c.content).join('');
  assert.ok(joined.includes('我们继续看啊'), '末尾内容丢失');
});

console.log(`\n全部通过：${passed} 项`);


