import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWordList, buildIndex, findPairs, findSingle, readFilters } from '../js/anagram-core.js';
import { BUILTIN_WORDS, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS } from '../js/wordlists.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const md = read('README.md');
const fmt = (n) => n.toLocaleString('en-US');
const lists = Object.fromEntries(BUNDLED_WORDLISTS.map((w) => [w.id, parseWordList(read(w.file))]));
const defaultIndex = buildIndex([BUILTIN_WORDS, ...DEFAULT_WORDLISTS.map((id) => lists[id].words)]);
const F = readFilters({ minLen: '2' }).filters;

// 見出し（## ）の後ろから、次の ## までを取り出す
function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

// Markdown の表の本体の行（見出しと区切りの行を除く）を、セルの配列にする
function tableRows(text) {
  const rows = text.split('\n').filter((l) => l.startsWith('| ')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  return rows.slice(1);
}

const h2 = md.replace(/```[\s\S]*?```/g, '').split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）', () => {
  const m = md.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML block');
  const yaml = m[1];
  const keys = [...yaml.matchAll(/^([a-z_]+):/gm)].map((x) => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en',
    'category_ja', 'category_en', 'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) assert.match(yaml, new RegExp(`^${k}:\\n  - `, 'm'), k);
  assert.match(yaml, /^id: day045$/m);
  assert.match(yaml, /^slug: anagram-hunter$/m);
  assert.match(yaml, /^repo_url: "https:\/\/github.com\/ipusiron\/anagram-hunter"$/m);
  assert.match(yaml, /^demo_url: "https:\/\/ipusiron.github.io\/anagram-hunter\/"$/m);
  assert.match(yaml, /^hub: true$/m);
});

test('シリーズ標準の構成（前半と後半の見出しの順、Day の表記、プロジェクトのリンク）', () => {
  assert.match(md, /\n# Anagram Hunter - .+\n/);
  assert.ok(md.includes('**Day045 - 生成AIで作るセキュリティツール100**'));
  assert.ok(h2[0].startsWith('🌐'));
  assert.ok(h2[1].startsWith('📸'));
  assert.deepEqual(h2.slice(-4).map((h) => [...h][0]), ['📁', '💻', '📄', '🛠']);
  for (const icon of ['✨', '📖', '🎯', '🔒', '⚠', '🧪']) assert.ok(h2.some((h) => h.startsWith(icon)), icon);
  assert.match(section(md, '🛠️ このツールについて'), /https:\/\/akademeia\.info\/\?page_id=42163/);
  const badges = ['stars', 'forks', 'last-commit', 'license'].map((b) => `img.shields.io/github/${b}/ipusiron/anagram-hunter`);
  for (const b of badges) assert.ok(md.includes(b), b);
});

test('強調は1節に2か所まで、箇条書きの項目名を太字にしない', () => {
  for (const h of h2) {
    const n = (section(md, h).match(/\*\*[^*\n]+\*\*/g) || []).length;
    assert.ok(n <= 2, `${h}: ${n}`);
  }
  assert.doesNotMatch(md, /^\s*- \*\*/m);
});

test('付属辞書の表は、wordlists/ の実ファイルと一致する', () => {
  const rows = tableRows(section(md, '📚 付属辞書'));
  assert.equal(rows.length, BUNDLED_WORDLISTS.length);
  for (const w of BUNDLED_WORDLISTS) {
    const row = rows.find((r) => r[0] === path.basename(w.file));
    assert.ok(row, w.file);
    assert.equal(row[2], fmt(lists[w.id].lines), `${w.id} lines`);
    assert.equal(row[3], fmt(lists[w.id].words.length), `${w.id} words`);
    assert.equal(row[4].trim(), DEFAULT_WORDLISTS.includes(w.id) ? '○' : '', w.id);
  }
  assert.ok(md.includes(`内蔵ミニ辞書（${BUILTIN_WORDS.length}語`));
  const all = buildIndex([BUILTIN_WORDS, ...BUNDLED_WORDLISTS.map((w) => lists[w.id].words)]);
  assert.ok(md.includes(`${fmt(all.words.length)}語（内蔵ミニ辞書を含む）`));
});

test('探索の仕組みの表（2語の組）と、本文の数値は実装と一致する', () => {
  const sec = section(md, '🔬 探索の仕組み');
  assert.ok(sec.includes(`${fmt(defaultIndex.words.length)}語`));
  const rows = tableRows(sec);
  assert.equal(rows.length, 4);
  for (const [input, pairs] of rows) {
    assert.deepEqual(findPairs(defaultIndex, input, F).pairs.map((p) => p.words.join(' ')), pairs.split(', '), input);
  }
  const listen = findSingle(defaultIndex, 'LISTEN', F);
  assert.ok(md.includes(`LISTENからは${listen.length}語`));
  assert.deepEqual(listen.filter((r) => r.kind === 'exact').map((r) => r.word).sort(), ['ENLIST', 'INLETS', 'LISTEN', 'SILENT']);
});

test('ALGORITHM.md の探索例（FIREWALL の1語目の候補の数と6組、総当たりの組の数）は実装と一致する', () => {
  const doc = read('ALGORITHM.md');
  const r = findPairs(defaultIndex, 'FIREWALL', F);
  assert.ok(doc.includes(`付属辞書を最初から使う状態（${fmt(defaultIndex.words.length)}語）では、FIREWALLの1語目の候補は${r.firstCandidates}語`));
  assert.ok(doc.includes(`${r.pairs.map((p) => p.words.join(' ')).join('・')}の${r.pairs.length}組`));
  assert.ok(doc.includes(`english_5067.txtは${fmt(lists.english_5067.lines)}行のうち${fmt(lists.english_5067.duplicates)}行が重複`));
  assert.ok(defaultIndex.words.length ** 2 > 9.5e6 && defaultIndex.words.length ** 2 < 1.1e7); // 「約1千万組」
});

test('ディレクトリー構造にすべてのファイルとディレクトリーが載り、全行に説明がある', () => {
  const block = section(md, '📁 ディレクトリー構造').match(/```\n([\s\S]*?)```/)[1];
  const lines = block.split('\n').filter(Boolean).slice(1);
  const listed = new Set();
  for (const line of lines) {
    const m = line.match(/^[│├└─\s]*([^\s#]+)\s+# (.+)$/);
    assert.ok(m, `説明のない行: ${line}`);
    listed.add(m[1].replace(/\/$/, ''));
  }
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((x) => !['.git', 'node_modules', '.claude'].includes(x.name))
    .flatMap((x) => (x.isDirectory() ? [x.name, ...walk(path.join(dir, x.name))] : [x.name]));
  for (const name of walk('.')) assert.ok(listed.has(name), `ツリーにない: ${name}`);
  for (const name of listed) assert.ok(walk('.').includes(name), `実在しない: ${name}`);
  const cols = new Set(lines.map((l) => l.indexOf(' # ')));
  assert.equal(cols.size, 1, [...cols].join(','));
});

test('画像: 参照はすべて実在し、assets/ の PNG は README から参照しているものだけ', () => {
  const refs = [...md.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
  assert.equal(refs.length, 3);
  for (const r of refs) assert.ok(fs.existsSync(path.join(ROOT, r)), r);
  const pngs = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.png')).map((f) => `assets/${f}`).sort();
  assert.deepEqual(pngs, [...new Set(refs)].sort());
  for (const p of pngs) assert.ok(fs.statSync(path.join(ROOT, p)).size <= 300 * 1024, p);
});
