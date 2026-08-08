import { chunkCorpusText, splitIntoSentences } from './chunk-logic.mjs';
const text = '对，就这样。然后呢？我们继续看啊。'.repeat(80);
const sentences = splitIntoSentences(text);
console.log('sentences:', sentences.length, 'last:', JSON.stringify(sentences[sentences.length - 1]));
const chunks = chunkCorpusText(text, { minChars: 400, maxChars: 800, overlap: true });
console.log('chunks:', chunks.length);
console.log('last chunk tail:', JSON.stringify(chunks[chunks.length - 1].content.slice(-40)));
const joined = chunks.map((c) => c.content).join('');
console.log('includes 我们继续看啊:', joined.includes('我们继续看啊'));
const seen = new Map();
for (const s of sentences) seen.set(s, (seen.get(s) || 0) + 1);
const countInJoined = {};
for (const s of sentences) {
  const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  countInJoined[s] = (joined.match(re) || []).length;
}
const missing = sentences.filter((s) => countInJoined[s] !== seen.get(s));
console.log('mismatch:', missing.length, 'sample:', missing.slice(0, 5).map((s) => JSON.stringify(s)));
