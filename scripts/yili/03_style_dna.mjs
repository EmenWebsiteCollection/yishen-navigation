// scripts/yili/03_style_dna.mjs
// 依力表达 DNA 蒸馏（借鉴 huashu-nuwa 方法论：句式/词汇/节奏/语气词/口癖）
// 输入：corpus_chunks.json（775 块真实语料）
// 输出：
//   1. src/services/yili-style-dna.js —— 可注入 system 的常驻风格底座（供 yili-chat 使用）
//   2. docs/yili-style-dna.md —— 人类可读的表达 DNA 档案
//
// 用法：node scripts/yili/03_style_dna.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { splitIntoSentences } from './chunk-logic.mjs';

const CHUNKS_JSON = fileURLToPath(new URL('./corpus_chunks.json', import.meta.url));
const OUT_JS = fileURLToPath(new URL('../../src/services/yili-style-dna.js', import.meta.url));
const OUT_MD = fileURLToPath(new URL('../../docs/yili-style-dna.md', import.meta.url));

const PARTICLES = ['啊', '吧', '呢', '吗', '呀', '哦', '嗯', '嘛', '哈', '哎', '哟', '啦', '呗', '诶', '唉', '啧', '噢', '嘞'];
const HABITS = ['对不对', '是不是', '好不好', '可以吧', '大家', '同学们', '老师', '呃', '那个', '就是说', '其实', '然后', '所以', '比如说', '举个例子', '咱们', '你比如说', '好，', '来，', '对，', '等一等', '等一下', '稍等', '注意', '重点', '干货', '上干货', '我先说', '我再说一遍', '听明白', '理解一下', '想一下', '想一想'];

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

function main() {
  const chunks = JSON.parse(readFileSync(CHUNKS_JSON, 'utf8'));
  const fullText = chunks.map((c) => c.content).join('');
  const chars = fullText.length;

  // 1) 语气词频率（每千字出现次数）
  const particleStats = PARTICLES.map((p) => ({ p, count: countOccurrences(fullText, p) }))
    .map((x) => ({ ...x, perK: +(x.count / (chars / 1000)).toFixed(1) }))
    .sort((a, b) => b.perK - a.perK);

  // 2) 口癖频率
  const habitStats = HABITS.map((h) => ({ h, count: countOccurrences(fullText, h) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  // 3) 句长分布与句式比例
  const sentences = [];
  for (const c of chunks) sentences.push(...splitIntoSentences(c.content));
  const lengths = sentences.map((s) => s.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
  const qMark = sentences.filter((s) => /？\s*$/.test(s)).length;
  const exMark = sentences.filter((s) => /！\s*$/.test(s)).length;
  const ellipsis = sentences.filter((s) => /…/.test(s)).length;
  const total = sentences.length;

  // 4) 高频实义词（粗：2-gram 频率 top，取有意义的词）
  const bigrams = new Map();
  const clean = fullText.replace(/[^\u4e00-\u9fa5]/g, '');
  for (let i = 0; i < clean.length - 1; i++) {
    const g = clean.slice(i, i + 2);
    if (g.includes('的') || g.includes('了')) continue;
    bigrams.set(g, (bigrams.get(g) || 0) + 1);
  }
  const topBigrams = [...bigrams.entries()]
    .filter(([, c]) => c > 30)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w, c]) => `${w}(${c})`);

  const particleTop = particleStats.slice(0, 8).map((x) => `${x.p}×${x.perK}/千字`).join('、');
  const habitTop = habitStats.slice(0, 15).map((x) => `${x.h}(${x.count})`).join('、');

  const dna = {
    name: '依力表达 DNA（基于 66 万字课程语料蒸馏）',
    voice: '活泼、口语化、爱用语气词、教学腔但接地气、自称"我/老师"与"大家/同学们"对话、常抛问题互动',
    particles: particleStats.slice(0, 8).map((x) => ({ particle: x.p, perK: x.perK })),
    habits: habitStats.slice(0, 15).map((x) => ({ habit: x.h, count: x.count })),
    sentence: {
      avgChars: +avgLen.toFixed(1),
      questionRatio: +(qMark / total).toFixed(3),
      exclaimRatio: +(exMark / total).toFixed(3),
      ellipsisRatio: +(ellipsis / total).toFixed(3),
    },
    topWords: topBigrams,
    antiPatterns: [
      '不用官方/客服腔，不写"感谢您的反馈，我们已记录"这类话',
      '不堆术语不解释（学生问才展开），先给结论再给例子',
      '不假装知道没讲过的内容，不知道就大方承认',
      '不一口气输出超长段落，像上课一样一段一个点',
    ],
    boundaries: [
      '仅能模仿表达风格，不能替代依力本人的教学判断与最新知识',
      '语料截至现有课程，涉及课程之外的领域应承认不了解',
      '不编造具体人名/专有名词/课程内容细节',
    ],
  };

  // 生成可注入的 JS 常量
  const js = `// src/services/yili-style-dna.js
// 依力表达 DNA（由 scripts/yili/03_style_dna.mjs 从 66 万字课程语料自动生成，勿手改）
// 作用：作为 yili-chat 常驻风格底座，与实时检索样本（<yili_samples>）双轨互补。

export const YILI_STYLE_DNA = ${JSON.stringify(dna, null, 2)};

// 可直接拼进 system prompt 的风格块
export function buildStyleDnaBlock() {
  const d = YILI_STYLE_DNA;
  const parts = [
    \`【依力的说话方式】（常驻风格底座，由真实语料统计得出，高浓度模仿）\`,
    \`声音：\${d.voice}\`,
    \`语气词：\${d.particles.map((p) => p.particle).join('')}（口语里高频出现，务必多用，宁可多说也不要像机器人）\`,
    \`高频口头禅：\${d.habits.slice(0, 10).map((h) => h.habit).join('、')}（自然地高频使用，这是依力的招牌）\`,
    \`句子节奏：平均每句约 \${d.sentence.avgChars} 字；约 \${Math.round(d.sentence.questionRatio * 100)}% 句子是问句，多说「对不对/是不是/好不好」；一段一个点，不写长段。\`,
    \`高频词参考：\${d.topWords.slice(0, 12).join('、')}\`,
    \`【高浓度规则】1.几乎每句都带语气词；2.开头常用「哎/好/来」；3.口癖（对不对/是不是/好不好/你看/然后呢）高频穿插；4.允许口语重复与啰嗦，不整理得太干净；5.用短句+反问跟用户互动。\`,
    \`【禁止】\${d.antiPatterns.join('；')}。\`,
    \`【诚实边界】\${d.boundaries.join('；')}。\`,
  ];
  return parts.join('\\n');
}
`;

  writeFileSync(OUT_JS, js, 'utf8');

  const md = `# 依力表达 DNA

> 由 scripts/yili/03_style_dna.mjs 从 775 块 / 约 57 万字课程语料自动蒸馏（借鉴 huashu-nuwa「表达 DNA」方法论）。用途：作为依力 AI 常驻风格底座，与实时检索样本双轨互补。

## 1. 声音与身份
${dna.voice}

## 2. 语气词（每千字出现次数）
${particleTop}

## 3. 高频口头禅（出现次数）
${habitTop}

## 4. 句式与节奏
- 平均句长：约 ${dna.sentence.avgChars} 字/句
- 问句占比：${(dna.sentence.questionRatio * 100).toFixed(1)}%（常抛问题与学生互动）
- 感叹句占比：${(dna.sentence.exclaimRatio * 100).toFixed(1)}%
- 省略号占比：${(dna.sentence.ellipsisRatio * 100).toFixed(1)}%（语气停顿）

## 5. 高频词（2-gram 粗统计 top30）
${topBigrams.join('、')}

## 6. 反模式（依力不会这样说话）
${dna.antiPatterns.map((x) => '- ' + x).join('\n')}

## 7. 诚实边界
${dna.boundaries.map((x) => '- ' + x).join('\n')}

## 8. 使用方式
- yili-chat.mjs 通过 buildStyleDnaBlock() 注入 system（常驻底座）
- <yili_samples> 实时检索样本（按话题贴合的依力原话）叠加在 DNA 之上
- 两者互补：DNA 保证稳定人设，样本保证贴合话题
`;

  writeFileSync(OUT_MD, md, 'utf8');

  console.log('== 依力表达 DNA 蒸馏结果 ==');
  console.log(`语料：${chunks.length} 块 / ${chars} 字符 / ${total} 句`);
  console.log(`平均句长：${dna.sentence.avgChars} 字；问句 ${(dna.sentence.questionRatio * 100).toFixed(1)}%；感叹 ${(dna.sentence.exclaimRatio * 100).toFixed(1)}%`);
  console.log('语气词 top8：' + particleTop);
  console.log('口头禅 top15：' + habitTop);
  console.log('高频词 top15：' + topBigrams.slice(0, 15).join('、'));
  console.log(`\n已生成：\n  ${OUT_JS}\n  ${OUT_MD}`);
}

main();


