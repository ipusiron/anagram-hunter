import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseWordList, buildIndex, readFilters, findPairs, findPhrases, compareLetters, removeWord, normalizePattern, findSingle, signature,
  PHRASE_LIMITS
} from '../js/anagram-core.js';
import { BUILTIN_WORDS, DEFAULT_WORDLISTS, bundledById } from '../js/wordlists.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const words = (id) => parseWordList(read(bundledById(id).file)).words;
const defaultIndex = buildIndex([BUILTIN_WORDS, ...DEFAULT_WORDLISTS.map(words)]);
const F = (o = {}) => readFilters({ minLen: '3', ...o }).filters;
const phrases = (idx, s, f, opts) => findPhrases(idx, s, f, opts).phrases.map((p) => p.words.join(' '));

test('位置の指定: 英字と ?（. _ も同じ）だけ。全角も受け付け、それ以外の文字は誤り', () => {
  assert.equal(normalizePattern('s?l???'), 'S?L???');
  assert.equal(normalizePattern('Ｓ._ ?'), 'S???');
  assert.equal(normalizePattern(''), '');
  assert.equal(normalizePattern('S*'), null);
  assert.equal(normalizePattern('S1'), null);
  assert.equal(readFilters({ pattern: 'A-B' }).error, 'pattern');
  const idx = buildIndex([BUILTIN_WORDS]);
  const r = findSingle(idx, 'LISTEN', readFilters({ pattern: '?I????' }).filters).map((x) => x.word);
  assert.deepEqual(r, ['LISTEN', 'SILENT']);
  assert.deepEqual(findSingle(idx, 'LISTEN', readFilters({ pattern: '???' }).filters), []);
});

test('語を取り除いた残り（作れないときは null）', () => {
  assert.equal(removeWord('LISTEN', 'NEST'), 'IL');
  assert.equal(removeWord('LISTEN', 'LISTEN'), '');
  assert.equal(removeWord('LISTEN', 'NESTS'), null);
});

test('フレーズ: 既定の辞書で ELEVENPLUSTWO から TWELVE PLUS ONE（3語、各3字以上、同じ語の繰り返しなし）', () => {
  assert.deepEqual(phrases(defaultIndex, 'ELEVENPLUSTWO', F(), { maxWords: 3, allowRepeat: false }), [
    'EVENT SOUP WELL', 'LEVEL SOUP WENT', 'LEVEL UPON WEST', 'VOWEL PLUS TEEN', 'LEVEL SETUP NOW', 'LEVEL SETUP OWN', 'SLEEP VOWEL NUT',
    'TWELVE PLUS ONE', 'TWELVE POLE SUN'
  ]);
});

test('フレーズ: 2語までに限ると、2語の探索（findPairs）と同じ組になる', () => {
  for (const s of ['DORMITORY', 'FIREWALL', 'ASTRONOMER', 'SCHOOLMASTER', 'TEAMTEAM']) {
    const a = findPhrases(defaultIndex, s, F({ minLen: '2' }), { maxWords: 2, limit: 1e9 }).phrases
      .filter((p) => p.words.length === 2).map((p) => [...p.words].sort().join(' ')).sort();
    const b = findPairs(defaultIndex, s, F({ minLen: '2' })).pairs.map((p) => p.words.join(' ')).sort();
    assert.deepEqual(a, b, s);
  }
});

test('フレーズ: どの組も入力の文字をちょうど使い切り、語の順だけが違う組は出ない', () => {
  const r = findPhrases(defaultIndex, 'ANAGRAMHUNTER', F(), { maxWords: 4, limit: 1e9 });
  assert.ok(r.phrases.length > 20);
  const seen = new Set();
  for (const p of r.phrases) {
    assert.equal(signature(p.words.join('')), signature('ANAGRAMHUNTER'), p.words.join(' '));
    const key = [...p.words].sort().join(' ');
    assert.ok(!seen.has(key), key);
    seen.add(key);
    assert.ok(p.words.length <= 4 && p.words.every((w) => w.length >= 3));
  }
  // 並び: 語数が少ない順、次に一番短い語が長い順
  const n = r.phrases.map((p) => p.words.length);
  assert.deepEqual(n, [...n].sort((a, b) => a - b));
});

test('フレーズ: 必ず含める語・使わない語・同じ語の繰り返し', () => {
  assert.deepEqual(phrases(defaultIndex, 'ELEVENPLUSTWO', F(), { maxWords: 3, include: ['TWELVE'], allowRepeat: false }),
    ['TWELVE PLUS ONE', 'TWELVE POLE SUN']);
  const r = findPhrases(defaultIndex, 'ELEVENPLUSTWO', F(), { maxWords: 3, include: ['ZOO'] });
  assert.deepEqual(r, { ok: false, error: 'includeNotInInput', word: 'ZOO' });
  const ex = phrases(defaultIndex, 'ELEVENPLUSTWO', F(), { maxWords: 3, exclude: ['PLUS'], allowRepeat: false });
  assert.ok(ex.length === 7 && ex.every((p) => !p.split(' ').includes('PLUS')));
  assert.deepEqual(phrases(defaultIndex, 'CYBERSECURITY', F(), { maxWords: 4, allowRepeat: true }),
    ['BITE CRY CRY USE', 'CITY CRY RUB SEE', 'CURE BIT CRY YES', 'REST BUY CRY ICE']);
  assert.deepEqual(phrases(defaultIndex, 'CYBERSECURITY', F(), { maxWords: 4, allowRepeat: false }),
    ['CITY CRY RUB SEE', 'CURE BIT CRY YES', 'REST BUY CRY ICE']);
  // 含める語だけで使い切るとき
  assert.deepEqual(phrases(defaultIndex, 'FIREWALL', F(), { maxWords: 3, include: ['FIRE', 'WALL'] }), ['FIRE WALL']);
});

test('フレーズ: 件数・手数・時間の上限で打ち切り、打ち切ったことを返す', () => {
  const r = findPhrases(defaultIndex, 'ELEVENPLUSTWO', F(), { maxWords: 3, limit: 2 });
  assert.equal(r.truncated, 'results');
  assert.equal(r.phrases.length, 2);
  const s = findPhrases(defaultIndex, 'ABCDEFGHIJKLMNOPQRSTUVWXY', F(), { maxWords: 5, steps: 500 });
  assert.equal(s.truncated, 'steps');
  const t = findPhrases(defaultIndex, 'ABCDEFGHIJKLMNOPQRSTUVWXY', F(), { maxWords: 5, timeMs: 0 });
  assert.equal(t.truncated, 'time');
  assert.equal(findPhrases(defaultIndex, 'ELEVENPLUSTWO', F(), { maxWords: 9 }).phrases.length,
    findPhrases(defaultIndex, 'ELEVENPLUSTWO', F(), { maxWords: PHRASE_LIMITS.maxWords }).phrases.length);
});

test('2つの文字列の比較: アナグラムどうしか、片方にだけある文字、片方で作れるか', () => {
  const r = compareLetters('The Morse Code', 'Here come dots');
  assert.equal(r.isAnagram, true);
  assert.equal(r.signatureA, 'CDEEEHMOORST');
  assert.equal(r.signatureA, r.signatureB);
  const d = compareLetters('LISTEN', 'TINSEL S');
  assert.equal(d.isAnagram, false);
  assert.deepEqual(d.onlyA, []);
  assert.deepEqual(d.onlyB, [{ letter: 'S', count: 1 }]);
  assert.equal(d.bContainsA, true);
  assert.equal(d.aContainsB, false);
  const e = compareLetters('', '');
  assert.equal(e.isAnagram, false);
});

test('大きい辞書（12dicts 3of6game）: 原本の改行だけを LF にしたファイルで、ASTRONOMER は1語と2語で114組', () => {
  const idx = buildIndex([words('twelvedicts')]);
  const r = phrases(idx, 'ASTRONOMER', F(), { maxWords: 2, allowRepeat: false });
  assert.equal(r.length, 114);
  assert.deepEqual(r.slice(0, 4), ['ASTRONOMER', 'ARMOR NOTES', 'ARMOR ONSET', 'ARMOR STENO']);
  assert.deepEqual(findPairs(idx, 'DORMITORY', F({ minLen: '2' })).pairs.map((p) => p.words.join(' ')), ['DIRT ROOMY', 'DIRTY MOOR', 'DIRTY ROOM']);
});
