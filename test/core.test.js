import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLetters, signature, freqVector, canCover, subtract, vectorToSignature, parseWordList, buildIndex,
  readFilters, passFilters, findSingle, findPairs, toCsv, MAX_WORD_LENGTH
} from '../js/anagram-core.js';
import { BUILTIN_WORDS } from '../js/wordlists.js';

const F = (o = {}) => readFilters({ minLen: '2', ...o }).filters;

test('正規化: 英字だけを大文字に。全角英字は半角に、アクセント記号は外す。空白は数えず、それ以外の文字は ignored に数える', () => {
  assert.deepEqual(normalizeLetters('listen'), { letters: 'LISTEN', ignored: 0 });
  assert.deepEqual(normalizeLetters('ＬＩＳＴＥＮ'), { letters: 'LISTEN', ignored: 0 });
  assert.deepEqual(normalizeLetters('café'), { letters: 'CAFE', ignored: 0 });
  assert.deepEqual(normalizeLetters('Straße'), { letters: 'STRASSE', ignored: 0 });
  assert.deepEqual(normalizeLetters('Tom  Marvolo\tRiddle\n'), { letters: 'TOMMARVOLORIDDLE', ignored: 0 });
  assert.deepEqual(normalizeLetters('a-dream 1!'), { letters: 'ADREAM', ignored: 3 });
  assert.deepEqual(normalizeLetters('あいう'), { letters: '', ignored: 3 });
  assert.deepEqual(normalizeLetters('<b>x</b>'), { letters: 'BXB', ignored: 5 });
  assert.deepEqual(normalizeLetters('😀A'), { letters: 'A', ignored: 1 });
  assert.deepEqual(normalizeLetters(''), { letters: '', ignored: 0 });
  assert.deepEqual(normalizeLetters(null), { letters: '', ignored: 0 });
});

test('署名と頻度ベクトル', () => {
  assert.equal(signature('LISTEN'), 'EILNST');
  assert.equal(signature('SILENT'), 'EILNST');
  const v = freqVector('LISTEN');
  assert.deepEqual([...v].map((n, i) => (n ? String.fromCharCode(65 + i) + n : '')).join(''), 'E1I1L1N1S1T1');
  assert.equal(vectorToSignature(v), 'EILNST');
  assert.ok(canCover(freqVector('NEST'), v));
  assert.ok(!canCover(freqVector('NESTS'), v));
  assert.equal(vectorToSignature(subtract(v, freqVector('NEST'))), 'IL');
  assert.equal(vectorToSignature(freqVector('')), '');
});

test('辞書ファイルの読み込み: 1行1語、空行は無視、正規化して重複を除く', () => {
  const r = parseWordList('listen\r\nSILENT\n\n  enlist  \nListen\na-dream\nadream\n123\n\r\n');
  assert.deepEqual(r.words, ['LISTEN', 'SILENT', 'ENLIST', 'ADREAM']);
  assert.equal(r.lines, 7);
  assert.equal(r.duplicates, 2);
  assert.equal(r.invalid, 1);
  assert.deepEqual(parseWordList('').words, []);
  assert.deepEqual(parseWordList('A\rB').words, ['A', 'B']);
});

test('索引: 複数の辞書の同じ語は1つ、署名ごとにまとまる', () => {
  const idx = buildIndex([['LISTEN', 'SILENT'], ['SILENT', 'ENLIST', 'STONE']]);
  assert.deepEqual(idx.words, ['LISTEN', 'SILENT', 'ENLIST', 'STONE']);
  assert.deepEqual(idx.bySignature.get('EILNST'), ['LISTEN', 'SILENT', 'ENLIST']);
  assert.equal(idx.bySignature.size, 2);
});

test('内蔵ミニ辞書は19語・6署名（重複なし）', () => {
  const idx = buildIndex([BUILTIN_WORDS]);
  assert.equal(BUILTIN_WORDS.length, 19);
  assert.equal(idx.words.length, 19);
  assert.equal(idx.bySignature.size, 6);
});

test('絞り込みの条件: 空欄は制限なし、数でない値・範囲外・最小＞最大は誤り', () => {
  assert.deepEqual(readFilters({}), { ok: true, filters: { minLen: 1, maxLen: MAX_WORD_LENGTH, startsWith: '', endsWith: '', contains: '' } });
  assert.deepEqual(readFilters({ minLen: ' 3 ', maxLen: '5', startsWith: '^s', endsWith: 'ｔ$', contains: 'é' }).filters,
    { minLen: 3, maxLen: 5, startsWith: 'S', endsWith: 'T', contains: 'E' });
  assert.equal(readFilters({ minLen: '0' }).error, 'minLen');
  assert.equal(readFilters({ minLen: '-1' }).error, 'minLen');
  assert.equal(readFilters({ minLen: '2.5' }).error, 'minLen');
  assert.equal(readFilters({ minLen: 'abc' }).error, 'minLen');
  assert.equal(readFilters({ maxLen: '0' }).error, 'maxLen');
  assert.equal(readFilters({ maxLen: String(MAX_WORD_LENGTH + 1) }).error, 'maxLen');
  assert.deepEqual(readFilters({ minLen: '7', maxLen: '3' }), { ok: false, error: 'range', min: 7, max: 3 });
  const f = F({ startsWith: 'S', endsWith: 'T', contains: 'LE' });
  assert.ok(passFilters('SILENT', f));
  assert.ok(!passFilters('LISTEN', f));
});

test('1語: LISTEN は SILENT・ENLIST・INLETS（と自身）が全文字を使う語。一部を使う語には残りの文字が付く', () => {
  const idx = buildIndex([BUILTIN_WORDS, ['LINE', 'LIST', 'NEST', 'IS', 'LISTENS']]);
  const r = findSingle(idx, 'LISTEN', F());
  assert.deepEqual(r.filter((x) => x.kind === 'exact').map((x) => x.word), ['ENLIST', 'INLETS', 'LISTEN', 'SILENT']);
  assert.deepEqual(r.filter((x) => x.kind === 'partial').map((x) => `${x.word}:${x.rest}`), ['LINE:ST', 'LIST:EN', 'NEST:IL', 'IS:ELNT']);
  assert.ok(!r.some((x) => x.word === 'LISTENS'));
  // 最大長は結果の語の長さにだけ掛かる（入力が最大長より長くても探索できる）
  const long = findSingle(idx, 'LISTENLISTENLISTENLISTEN', F({ maxLen: '4' }));
  const have = freqVector('LISTENLISTENLISTENLISTEN');
  assert.deepEqual(long.map((x) => x.word), ['LEAP', 'LINE', 'LIST', 'NEST', 'IS'].filter((w) => canCover(freqVector(w), have)));
  assert.deepEqual(findSingle(idx, '', F()), []);
});

test('2語: 署名の引き当て（全探索）が、総当たりと同じ組を返す。組は1回だけ、同じ語を2回使う組も含む', () => {
  const words = ['TEAM', 'MEAT', 'MATE', 'TAME', 'TEA', 'ME', 'AT', 'MA', 'ETA', 'EAT', 'LEAP', 'PALE', 'A', 'MAT'];
  const idx = buildIndex([words]);
  for (const s of ['TEAMTEAM', 'TEAME', 'MEATPALE', 'ATMA', 'XYZ', 'TEAM']) {
    const got = findPairs(idx, s, F({ minLen: '1' })).pairs.map((p) => p.words.join(' '));
    const brute = new Set();
    for (const a of words) for (const b of words) if (signature(a + b) === signature(s)) brute.add([a, b].sort().join(' '));
    assert.deepEqual(new Set(got), brute, s);
    assert.equal(got.length, brute.size, s);
  }
  assert.deepEqual(findPairs(idx, 'TEAMTEAM', F()).pairs.slice(0, 3).map((p) => p.words.join(' ')), ['MATE MATE', 'MATE MEAT', 'MATE TAME']);
});

test('2語: 並びは短いほうの語が長い順、次に ABC 順。1語目の候補の数も返す', () => {
  const idx = buildIndex([['FAIR', 'WELL', 'LAW', 'RIFLE', 'FIRE', 'WALL', 'FIREWALL']]);
  const r = findPairs(idx, 'FIREWALL', F());
  assert.deepEqual(r.pairs.map((p) => p.words.join(' ')), ['FAIR WELL', 'FIRE WALL', 'LAW RIFLE']);
  assert.ok(r.pairs.every((p) => p.length === 8));
  // 1語目の候補＝入力より短く、入力の文字から作れる語（FIREWALL 自身は除く）
  assert.equal(r.firstCandidates, 6);
});

test('2語: 絞り込みは両方の語に掛かる', () => {
  const idx = buildIndex([['FAIR', 'WELL', 'LAW', 'RIFLE', 'FIRE', 'WALL']]);
  assert.deepEqual(findPairs(idx, 'FIREWALL', F({ minLen: '4', maxLen: '4' })).pairs.map((p) => p.words.join(' ')), ['FAIR WELL', 'FIRE WALL']);
  assert.deepEqual(findPairs(idx, 'FIREWALL', F({ startsWith: 'F' })).pairs, []);
  assert.deepEqual(findPairs(idx, 'FIREWALL', F({ contains: 'L' })).pairs.map((p) => p.words.join(' ')), ['LAW RIFLE']);
});

test('CSV: BOM つき、CRLF、引用符の二重化', () => {
  const csv = toCsv(['rank', 'candidate'], [[1, 'ARREST MOON'], [2, 'say "hi"']]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv.slice(1), '"rank","candidate"\r\n"1","ARREST MOON"\r\n"2","say ""hi"""\r\n');
});
