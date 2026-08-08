// scripts/yili/01_chunk_corpus.mjs
// 依力语料切块：读 base_*.txt → 句群切块 → 写 corpus_chunks.json
//
// 用法：
//   node scripts/yili/01_chunk_corpus.mjs [语料目录] [输出json]
//   默认目录 C:\Users\34405\Documents\ChatGPT\依力语料
//   默认输出 scripts/yili/corpus_chunks.json
//
// 注意：PowerShell 下调用请先 $OutputEncoding = [System.Text.Encoding]::UTF8
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkCorpusText } from './chunk-logic.mjs';

const DEFAULT_DIR = 'C:\\Users\\34405\\Documents\\ChatGPT\\依力语料';
const DEFAULT_OUT = fileURLToPath(new URL('./corpus_chunks.json', import.meta.url));

function naturalCompare(a, b) {
  return a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
}

function main() {
  const dir = process.argv[2] || DEFAULT_DIR;
  const outPath = process.argv[3] || DEFAULT_OUT;
  if (!existsSync(dir)) {
    console.error(`语料目录不存在: ${dir}`);
    process.exit(1);
  }
  const files = readdirSync(dir)
    .filter((f) => /^base_\d+_.*\.txt$/.test(f))
    .sort(naturalCompare);

  if (files.length === 0) {
    console.error('未找到 base_*.txt 文件');
    process.exit(1);
  }

  const chunks = [];
  let totalChars = 0;
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8');
    // 去除 BOM
    const text = raw.replace(/^\uFEFF/, '');
    const pieces = chunkCorpusText(text, { minChars: 400, maxChars: 800, overlap: true });
    pieces.forEach((p, i) => {
      chunks.push({
        doc_id: file,
        chunk_index: i,
        content: p.content,
        token_count: p.token_count,
        source_file: file,
      });
    });
    const fileChars = text.replace(/\s/g, '').length;
    totalChars += fileChars;
    console.log(`${file.padEnd(42)} 块数=${String(pieces.length).padStart(4)} 字数=${fileChars}`);
  }

  writeFileSync(outPath, JSON.stringify(chunks, null, 0), 'utf8');
  console.log('----------------------------------------');
  console.log(`文件数=${files.length} 总块数=${chunks.length} 总字数≈${totalChars}`);
  console.log(`输出: ${resolve(outPath)}`);
}

main();

