import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseWordList, buildIndex, findPairs, findSingle, readFilters } from '../js/anagram-core.js';
import { BUILTIN_WORDS, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS, bundledById, displayName, MAX_NAME_LENGTH } from '../js/wordlists.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const lists = Object.fromEntries(BUNDLED_WORDLISTS.map((w) => [w.id, parseWordList(read(w.file))]));
const F = readFilters({ minLen: '2' }).filters;
const pairs = (idx, s) => findPairs(idx, s, F).pairs.map((p) => p.words.join(' '));

test('付属辞書の行数と語数（正規化して重複を除いたあと）が一覧の値と一致する', () => {
  assert.equal(BUNDLED_WORDLISTS.length, 5);
  for (const w of BUNDLED_WORDLISTS) {
    assert.equal(lists[w.id].lines, w.lines, `${w.id} lines`);
    assert.equal(lists[w.id].words.length, w.words, `${w.id} words`);
    assert.equal(lists[w.id].invalid, 0, `${w.id} invalid`);
  }
  // wordlists/ の .txt はすべて一覧に載っている
  const files = fs.readdirSync(new URL('../wordlists/', import.meta.url)).filter((f) => f.endsWith('.txt')).map((f) => `wordlists/${f}`).sort();
  assert.deepEqual(BUNDLED_WORDLISTS.map((w) => w.file).sort(), files);
  for (const id of DEFAULT_WORDLISTS) assert.ok(bundledById(id), id);
  assert.equal(bundledById('nothing'), null);
});

test('既知解答（既定の辞書＝内蔵＋english_5067＋english_1842）', () => {
  const idx = buildIndex([BUILTIN_WORDS, ...DEFAULT_WORDLISTS.map((id) => lists[id].words)]);
  assert.equal(idx.words.length, 3233);
  assert.deepEqual(pairs(idx, 'DORMITORY'), ['DIRTY ROOM']);
  assert.deepEqual(pairs(idx, 'DEBITCARD'), ['CARD DEBIT', 'BAD CREDIT', 'BAD DIRECT']);
  assert.deepEqual(pairs(idx, 'SCHOOLMASTER'), ['MASTER SCHOOL', 'SCHOOL STREAM', 'CLASSROOM THE']);
  assert.deepEqual(pairs(idx, 'ASTRONOMER'), ['ARMOR NOTES', 'ARMOR STONE', 'ARMOR TONES', 'ARREST MOON']);
  assert.deepEqual(pairs(idx, 'FIREWALL'), ['FAIR WELL', 'FALL WIRE', 'FEAR WILL', 'FILL WEAR', 'FIRE WALL', 'LAW RIFLE']);
  assert.deepEqual(pairs(idx, 'THEEYES'), ['SEE THEY']);
  assert.deepEqual(pairs(idx, 'PASSWORD'), ['PASS WORD']);
  const single = findSingle(idx, 'LISTEN', F);
  assert.deepEqual(single.filter((x) => x.kind === 'exact').map((x) => x.word), ['ENLIST', 'INLETS', 'LISTEN', 'SILENT']);
  assert.equal(single.length, 21);
});

test('既知解答（付属辞書4本＝既定＋security＋animals）', () => {
  const idx = buildIndex([BUILTIN_WORDS, ...['english_5067', 'english_1842', 'security', 'animals'].map((id) => lists[id].words)]);
  assert.equal(idx.words.length, 4360);
  assert.deepEqual(pairs(idx, 'ASTRONOMER'), ['ARMOR NOTES', 'ARMOR STONE', 'ARMOR TONES', 'ARREST MOON', 'MAN ROOSTER']);
  assert.deepEqual(pairs(idx, 'CYBERSECURITY'), ['CYBER SECURITY']);
  assert.deepEqual(pairs(idx, 'ENCRYPTION'), ['CROP NINETY', 'CRYPTO NINE']);
});

test('辞書名: 制御文字を空白に、長すぎる名前は切る', () => {
  assert.equal(displayName('my\tlist\u0007.txt'), 'my list .txt');
  assert.equal(displayName('<img src=x onerror=alert(1)>.txt'), '<img src=x onerror=alert(1)>.txt');
  const long = displayName('a'.repeat(200));
  assert.equal(long.length, MAX_NAME_LENGTH);
  assert.ok(long.endsWith('…'));
  assert.equal(displayName(undefined), '');
});
