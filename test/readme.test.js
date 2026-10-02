import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWordList, buildIndex, findPairs, findSingle, findPhrases, readFilters } from '../js/anagram-core.js';
import { BUILTIN_WORDS, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS } from '../js/wordlists.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const fmt = (n) => n.toLocaleString('en-US');
const lists = Object.fromEntries(BUNDLED_WORDLISTS.map((w) => [w.id, parseWordList(read(w.file))]));
const defaultIndex = buildIndex([BUILTIN_WORDS, ...DEFAULT_WORDLISTS.map((id) => lists[id].words)]);
const small = buildIndex([BUILTIN_WORDS, ...BUNDLED_WORDLISTS.filter((w) => w.id !== 'twelvedicts').map((w) => lists[w.id].words)]);
const bigOnly = buildIndex([lists.twelvedicts.words]);
const F = readFilters({ minLen: '2' }).filters;
const F3 = readFilters({ minLen: '3' }).filters;
const listen = findSingle(defaultIndex, 'LISTEN', F).length;
const dorm = findPairs(bigOnly, 'DORMITORY', F).pairs.map((p) => p.words.join(' '));

const DOCS = {
  ja: {
    file: 'README.md',
    switcher: '[English](README.en.md) · 日本語',
    day: '**Day045 - 生成AIで作るセキュリティツール100**',
    bundled: '📚 付属辞書',
    how: '🔬 探索の仕組み',
    tree: '📁 ディレクトリー構造',
    about: '🛠️ このツールについて',
    images: /^assets\/screenshot\d*\.png$/,
    conditions: { '3語まで': { maxWords: 3 }, '3語まで、TWELVEを含める': { maxWords: 3, include: ['TWELVE'] }, '4語まで': { maxWords: 4 } },
    claims: [
      `内蔵ミニ辞書（${BUILTIN_WORDS.length}語`,
      `小さい付属辞書5本は合わせても${fmt(small.words.length)}語（内蔵ミニ辞書を含む）`,
      `大きい英単語辞書（${fmt(lists.twelvedicts.words.length)}語）`,
      `（内蔵＋english_5067＋english_1842、${fmt(defaultIndex.words.length)}語）`,
      `LISTENからは${listen}語`,
      `DORMITORYの2語の組は${dorm.join('・')}の${dorm.length}組`
    ]
  },
  en: {
    file: 'README.en.md',
    switcher: 'English · [日本語](README.md)',
    day: '**Day045 - 100 Security Tools with Generative AI**',
    bundled: '📚 Bundled dictionaries',
    how: '🔬 How the search works',
    tree: '📁 Directory structure',
    about: '🛠️ About this tool',
    images: /^assets\/en\/screenshot\d*\.png$/,
    conditions: { 'Up to 3 words': { maxWords: 3 }, 'Up to 3 words, include TWELVE': { maxWords: 3, include: ['TWELVE'] }, 'Up to 4 words': { maxWords: 4 } },
    claims: [
      `built-in mini dictionary (${BUILTIN_WORDS.length} words`,
      `The five small bundled dictionaries have ${fmt(small.words.length)} words in total`,
      `large English dictionary (${fmt(lists.twelvedicts.words.length)} words)`,
      `english_1842, ${fmt(defaultIndex.words.length)} words)`,
      `LISTEN gives ${listen} words`,
      `DORMITORY gives ${['', 'one', 'two', 'three'][dorm.length]} pairs: ${dorm.slice(0, -1).join(', ')} and ${dorm.at(-1)}`
    ]
  }
};
for (const d of Object.values(DOCS)) d.text = read(d.file);

// 見出し（## ）の後ろから、次の ## までを取り出す
function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

// Markdown の表の行をセルの配列にする。firstHeader で始まる表だけを取り出し、見出しと区切りの行は除く
function table(text, firstHeader) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`| ${firstHeader} |`));
  assert.ok(start >= 0, firstHeader);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
  return rows;
}

const h2 = (md) => md.replace(/```[\s\S]*?```/g, '').split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
const headings = (md) => md.replace(/```[\s\S]*?```/g, '').split('\n').filter((l) => /^#{1,4} /.test(l));

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）。YAML は README.md だけに置く', () => {
  const m = DOCS.ja.text.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
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
  assert.doesNotMatch(DOCS.en.text, /^<!--/);
});

test('日英の README は同じ見出しを同じ順に持つ（階層と絵文字がそろう）', () => {
  const ja = headings(DOCS.ja.text);
  const en = headings(DOCS.en.text);
  assert.equal(en.length, ja.length);
  ja.forEach((h, i) => {
    assert.equal(en[i].match(/^#+/)[0], h.match(/^#+/)[0], `${h} / ${en[i]}`);
    if (h.startsWith('## ')) assert.equal([...en[i].slice(3)][0], [...h.slice(3)][0], `${h} / ${en[i]}`);
  });
});

for (const [lang, d] of Object.entries(DOCS)) {
  test(`${d.file}: シリーズ標準の構成（前半と後半の見出しの順、Day の表記、言語の切り替え、プロジェクトのリンク）`, () => {
    const heads = h2(d.text);
    assert.ok(d.text.includes(d.switcher));
    assert.match(d.text, /\n# Anagram Hunter - .+\n/);
    assert.ok(d.text.includes(d.day));
    assert.ok(heads[0].startsWith('🌐'));
    assert.ok(heads[1].startsWith('📸'));
    assert.deepEqual(heads.slice(-4).map((h) => [...h][0]), ['📁', '💻', '📄', '🛠']);
    for (const icon of ['✨', '📖', '🎯', '🔒', '⚠', '🧪']) assert.ok(heads.some((h) => h.startsWith(icon)), icon);
    assert.match(section(d.text, d.about), /https:\/\/akademeia\.info\/\?page_id=42163/);
    for (const b of ['stars', 'forks', 'last-commit', 'license']) assert.ok(d.text.includes(`img.shields.io/github/${b}/ipusiron/anagram-hunter`), b);
  });

  test(`${d.file}: 強調は1節に2か所まで、箇条書きの項目名を太字にしない`, () => {
    for (const h of h2(d.text)) {
      const n = (section(d.text, h).match(/\*\*[^*\n]+\*\*/g) || []).length;
      assert.ok(n <= 2, `${h}: ${n}`);
    }
    assert.doesNotMatch(d.text, /^\s*- \*\*/m);
  });

  test(`${d.file}: 付属辞書の表は wordlists/ の実ファイルと一致し、本文の数値も実装と一致する`, () => {
    const rows = table(section(d.text, d.bundled), lang === 'ja' ? 'ファイル' : 'File');
    assert.equal(rows.length, BUNDLED_WORDLISTS.length);
    for (const w of BUNDLED_WORDLISTS) {
      const row = rows.find((r) => r[0] === path.basename(w.file));
      assert.ok(row, w.file);
      assert.equal(row[2], fmt(lists[w.id].lines), `${w.id} lines`);
      assert.equal(row[3], fmt(lists[w.id].words.length), `${w.id} words`);
      assert.equal(row[4], DEFAULT_WORDLISTS.includes(w.id) ? '○' : '', w.id);
    }
    for (const c of d.claims) assert.ok(d.text.includes(c), c);
  });

  test(`${d.file}: 2語の組の表とフレーズの表は、実装の探索結果と一致する`, () => {
    const sec = section(d.text, d.how);
    const pairs = table(sec, lang === 'ja' ? '入力 | 2語の組' : 'Input | Pairs');
    assert.equal(pairs.length, 4);
    for (const [input, list] of pairs) {
      assert.deepEqual(findPairs(defaultIndex, input, F).pairs.map((p) => p.words.join(' ')), list.split(', '), input);
    }
    const phrases = table(sec, lang === 'ja' ? '入力 | 条件' : 'Input | Conditions');
    assert.equal(phrases.length, 3);
    for (const [input, cond, list] of phrases) {
      assert.ok(cond in d.conditions, cond);
      const r = findPhrases(defaultIndex, input, F3, { ...d.conditions[cond], allowRepeat: false });
      assert.deepEqual(r.phrases.map((p) => p.words.join(' ')), list.split(', '), `${input} ${cond}`);
    }
  });

  test(`${d.file}: ディレクトリー構造にすべてのファイルとディレクトリーが載り、全行に説明がある`, () => {
    const block = section(d.text, d.tree).match(/```\n([\s\S]*?)```/)[1];
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
    const all = walk('.');
    for (const name of all) assert.ok(listed.has(name), `ツリーにない: ${name}`);
    for (const name of listed) assert.ok(all.includes(name), `実在しない: ${name}`);
    const cols = new Set(lines.map((l) => l.indexOf(' # ')));
    assert.equal(cols.size, 1, [...cols].join(','));
  });
}

test('画像: 参照はすべて実在し、日本語版は assets/、英語版は assets/en/ の画像を使う。参照していない PNG は置かない', () => {
  const refs = {};
  for (const [lang, d] of Object.entries(DOCS)) {
    refs[lang] = [...d.text.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
    assert.equal(refs[lang].length, 5, lang);
    for (const r of refs[lang]) {
      assert.ok(fs.existsSync(path.join(ROOT, r)), r);
      assert.match(r, d.images, r);
      assert.ok(fs.statSync(path.join(ROOT, r)).size <= 300 * 1024, r);
    }
  }
  const pngs = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`).sort();
  assert.deepEqual(pngs('assets'), [...new Set(refs.ja)].sort());
  assert.deepEqual(pngs('assets/en'), [...new Set(refs.en)].sort());
});

test('ALGORITHM.md の探索例（FIREWALL の1語目の候補の数と6組、総当たりの組の数）は実装と一致する', () => {
  const doc = read('ALGORITHM.md');
  const r = findPairs(defaultIndex, 'FIREWALL', F);
  assert.ok(doc.includes(`付属辞書を最初から使う状態（${fmt(defaultIndex.words.length)}語）では、FIREWALLの1語目の候補は${r.firstCandidates}語`));
  assert.ok(doc.includes(`${r.pairs.map((p) => p.words.join(' ')).join('・')}の${r.pairs.length}組`));
  assert.ok(doc.includes(`english_5067.txtは${fmt(lists.english_5067.lines)}行のうち${fmt(lists.english_5067.duplicates)}行が重複`));
  assert.ok(defaultIndex.words.length ** 2 > 9.5e6 && defaultIndex.words.length ** 2 < 1.1e7); // 「約1千万組」
  const ph = findPhrases(defaultIndex, 'ELEVENPLUSTWO', F3, { maxWords: 3, allowRepeat: false });
  assert.ok(doc.includes(`候補は${ph.candidates}語、手数は${ph.steps}で、TWELVE PLUS ONEを含む${ph.phrases.length}組`));
});
