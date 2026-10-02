// Anagram Hunter の探索ロジック（DOM 非依存。画面と node:test の両方から読む）
// 語は A〜Z の大文字だけで扱う。署名＝文字を並べ替えた文字列（LISTEN → EILNST）、
// 頻度ベクトル＝A〜Z の26文字それぞれの個数。どちらも「並べ替えると同じ語か」を判定する道具になる

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// 入力の上限（文字数）。1語・2語の探索は辞書を1回なめるだけなので、入力の長さで遅くはならない。画面の扱いやすさの上限
export const MAX_INPUT_LETTERS = 100;
// 結果の語の長さの上限として受け付ける最大値
export const MAX_WORD_LENGTH = 100;

// 入力を A〜Z の大文字にそろえる。全角英字（ＬＩＳＴＥＮ）は NFKC で半角に、アクセント記号（é）は NFD で分けて外す。
// 空白は区切りとして数えず、それ以外の英字でない文字（数字・記号・かななど）は ignored に数える
export function normalizeLetters(text) {
  const decomposed = String(text ?? '').normalize('NFKC').normalize('NFD');
  let letters = '';
  let ignored = 0;
  for (const ch of decomposed) {
    if (/\p{M}/u.test(ch) || /\s/u.test(ch)) continue;
    const up = ch.toUpperCase();
    // ß → SS のように、大文字にすると英字の並びになるものはそのまま使う
    if (/^[A-Z]+$/.test(up)) letters += up;
    else ignored += 1;
  }
  return { letters, ignored };
}

export function signature(word) {
  return word.split('').sort().join('');
}

export function freqVector(word) {
  const v = new Uint8Array(26);
  for (let i = 0; i < word.length; i++) {
    const k = word.charCodeAt(i) - 65;
    if (k >= 0 && k < 26) v[k] += 1;
  }
  return v;
}

// need の各文字の個数が have 以下か（need の語を have の文字から作れるか）
export function canCover(need, have) {
  for (let i = 0; i < 26; i++) if (need[i] > have[i]) return false;
  return true;
}

export function subtract(have, need) {
  const out = new Uint8Array(26);
  for (let i = 0; i < 26; i++) out[i] = have[i] - need[i];
  return out;
}

// 頻度ベクトルを、その文字を並べた署名に戻す（[1,0,0,…,1] → "AZ"）
export function vectorToSignature(v) {
  let s = '';
  for (let i = 0; i < 26; i++) if (v[i]) s += ALPHABET[i].repeat(v[i]);
  return s;
}

// 辞書ファイルの本文を語の一覧にする。1行に1語、行の前後の空白は無視、英字でない文字は外す（a-dream → ADREAM）。
// lines＝空でない行の数、invalid＝英字が1文字も残らなかった行、duplicates＝正規化すると前の行と同じになった行
export function parseWordList(text) {
  const seen = new Set();
  let lines = 0;
  let invalid = 0;
  let duplicates = 0;
  for (const raw of String(text ?? '').split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line) continue;
    lines += 1;
    const { letters } = normalizeLetters(line);
    if (!letters) invalid += 1;
    else if (seen.has(letters)) duplicates += 1;
    else seen.add(letters);
  }
  return { words: [...seen], lines, invalid, duplicates };
}

// 複数の辞書（語の配列の配列）を1つの索引にまとめる。同じ語は1つにする
export function buildIndex(wordLists) {
  const words = [];
  const seen = new Set();
  for (const list of wordLists) {
    for (const w of list) {
      if (!w || seen.has(w)) continue;
      seen.add(w);
      words.push(w);
    }
  }
  const bySignature = new Map();
  const freq = new Map();
  for (const w of words) {
    const sig = signature(w);
    if (!bySignature.has(sig)) bySignature.set(sig, []);
    bySignature.get(sig).push(w);
    freq.set(w, freqVector(w));
  }
  return { words, bySignature, freq };
}

// 位置の指定（クロスワード式）。英字はその位置の文字、? . _ はどの文字でもよい1字（S?L??? → 6文字で、1文字目がS・3文字目がL）。
// 空白は無視。それ以外の文字があれば null（誤り）を返す
export function normalizePattern(text) {
  const decomposed = String(text ?? '').normalize('NFKC').normalize('NFD');
  let out = '';
  for (const ch of decomposed) {
    if (/\p{M}/u.test(ch) || /\s/u.test(ch)) continue;
    if (ch === '?' || ch === '.' || ch === '_') out += '?';
    else if (/^[A-Z]$/.test(ch.toUpperCase())) out += ch.toUpperCase();
    else return null;
  }
  return out;
}

// 画面の入力（文字列）から絞り込みの条件を作る。誤りは { ok: false, error: キー, ... } で返す（文言は messages.js）
export function readFilters({ minLen = '', maxLen = '', startsWith = '', endsWith = '', contains = '', pattern = '' } = {}) {
  const num = (s) => {
    const t = String(s ?? '').trim();
    if (t === '') return null;
    return /^\d+$/.test(t) ? Number(t) : NaN;
  };
  const min = num(minLen);
  const max = num(maxLen);
  if (Number.isNaN(min) || (min !== null && (min < 1 || min > MAX_WORD_LENGTH))) return { ok: false, error: 'minLen', limit: MAX_WORD_LENGTH };
  if (Number.isNaN(max) || (max !== null && (max < 1 || max > MAX_WORD_LENGTH))) return { ok: false, error: 'maxLen', limit: MAX_WORD_LENGTH };
  const lo = min ?? 1;
  const hi = max ?? MAX_WORD_LENGTH;
  if (lo > hi) return { ok: false, error: 'range', min: lo, max: hi };
  const pat = normalizePattern(pattern);
  if (pat === null) return { ok: false, error: 'pattern' };
  return {
    ok: true,
    filters: {
      minLen: lo,
      maxLen: hi,
      startsWith: normalizeLetters(startsWith).letters,
      endsWith: normalizeLetters(endsWith).letters,
      contains: normalizeLetters(contains).letters,
      pattern: pat
    }
  };
}

export function passFilters(word, f) {
  if (word.length < f.minLen || word.length > f.maxLen) return false;
  if (f.startsWith && !word.startsWith(f.startsWith)) return false;
  if (f.endsWith && !word.endsWith(f.endsWith)) return false;
  if (f.contains && !word.includes(f.contains)) return false;
  if (f.pattern) {
    if (word.length !== f.pattern.length) return false;
    for (let i = 0; i < word.length; i++) if (f.pattern[i] !== '?' && f.pattern[i] !== word[i]) return false;
  }
  return true;
}

const byWord = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// 1語のアナグラム。kind＝exact（入力の文字をすべて使う）／partial（一部だけ使う）。rest＝使わずに残る文字（署名の形）
// 並びは exact が先、次に長い語、同じ長さは ABC 順
export function findSingle(index, letters, filters) {
  const have = freqVector(letters);
  const out = [];
  for (const w of index.words) {
    if (w.length > letters.length || !passFilters(w, filters)) continue;
    const fv = index.freq.get(w);
    if (!canCover(fv, have)) continue;
    const rest = vectorToSignature(subtract(have, fv));
    out.push({ word: w, kind: rest ? 'partial' : 'exact', rest });
  }
  out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'exact' ? -1 : 1) || b.word.length - a.word.length || byWord(a.word, b.word));
  return out;
}

// 2語のアナグラム（入力の文字をちょうど使い切る組）。1語目 w1 を選ぶと、2語目の署名は「残りの文字」に決まるので、
// 署名の索引を1回引けば2語目がすべて分かる＝辞書を1回なめるだけの全探索になる。
// 組は ABC 順の2語で1回だけ数える。同じ語を2回使う組（MATE MATE）も含む。
// 並びは短いほうの語が長い順（3字＋5字より4字＋4字を先に）、次に ABC 順
export function findPairs(index, letters, filters) {
  const have = freqVector(letters);
  const seen = new Set();
  const pairs = [];
  let firstCandidates = 0;
  for (const w1 of index.words) {
    if (w1.length >= letters.length || !passFilters(w1, filters)) continue;
    const fv = index.freq.get(w1);
    if (!canCover(fv, have)) continue;
    firstCandidates += 1;
    const rest = vectorToSignature(subtract(have, fv));
    for (const w2 of index.bySignature.get(rest) || []) {
      if (!passFilters(w2, filters)) continue;
      const words = w1 <= w2 ? [w1, w2] : [w2, w1];
      const key = words.join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ words, length: letters.length });
    }
  }
  const shorter = (p) => Math.min(p.words[0].length, p.words[1].length);
  pairs.sort((a, b) => shorter(b) - shorter(a) || byWord(a.words.join(' '), b.words.join(' ')));
  return { pairs, firstCandidates };
}

// 入力の文字から語の文字を取り除いた残り（署名の形）。作れないときは null
export function removeWord(letters, word) {
  const have = freqVector(letters);
  const need = freqVector(word);
  return canCover(need, have) ? vectorToSignature(subtract(have, need)) : null;
}

export const PHRASE_LIMITS = { maxWords: 5, results: 5000, steps: 2000000 };

// 複数語（フレーズ）のアナグラム。入力の文字をちょうど使い切る、maxWords 語以下の組をすべて探す。
// opts: maxWords（必ず含める語を含めた語数の上限）、include（必ず含める語の配列）、exclude（使わない語の配列）、
//       allowRepeat（同じ語を2回以上使ってよいか）、limit（結果の上限）、steps（探索の手数の上限）
// 語は長い順に並べた候補から、前に選んだ語より後ろ（同じ語の繰り返しを許すなら同じ位置から）だけを選ぶので、
// 語の順だけが違う組は1回しか出ない。最後の1語は、残りの文字の署名で索引を引いて決める（2語の探索と同じ）
export function findPhrases(index, letters, filters, opts = {}) {
  const maxWords = Math.min(opts.maxWords ?? 3, PHRASE_LIMITS.maxWords);
  const limit = opts.limit ?? 1000;
  const stepLimit = opts.steps ?? PHRASE_LIMITS.steps;
  const include = opts.include ?? [];
  const exclude = new Set(opts.exclude ?? []);
  let have = freqVector(letters);
  for (const w of include) {
    const fv = freqVector(w);
    if (!canCover(fv, have)) return { ok: false, error: 'includeNotInInput', word: w };
    have = subtract(have, fv);
  }
  const left0 = letters.length - include.reduce((n, w) => n + w.length, 0);
  const slots = maxWords - include.length;
  const result = { ok: true, phrases: [], truncated: null, steps: 0, candidates: 0 };
  if (left0 === 0) {
    if (include.length) result.phrases.push({ words: [...include], found: [] });
    return result;
  }
  if (slots <= 0) return result;

  const pool = index.words.filter((w) => !exclude.has(w) && passFilters(w, filters) && w.length <= left0 && canCover(index.freq.get(w), have));
  pool.sort((a, b) => b.length - a.length || byWord(a, b));
  const position = new Map(pool.map((w, i) => [w, i]));
  const vec = pool.map((w) => index.freq.get(w));
  result.candidates = pool.length;
  const minLen = filters.minLen;
  const acc = [];
  const timeLimit = opts.timeMs ?? Infinity;
  const started = Date.now();

  const record = (words) => {
    result.phrases.push({ words: [...include, ...words], found: words });
    if (result.phrases.length >= limit) result.truncated = 'results';
  };

  // cands＝いまの残りの文字で作れる候補（pool の位置、昇順）。子へは、その語を除いた残りでも作れる候補だけを渡す
  const rec = (cur, cands, start, left, slotsLeft) => {
    if (result.truncated) return;
    result.steps += 1;
    if (result.steps > stepLimit) {
      result.truncated = 'steps';
      return;
    }
    if (result.steps % 1024 === 0 && Date.now() - started > timeLimit) {
      result.truncated = 'time';
      return;
    }
    // 最後の1語: 署名で引く（候補の並びで start 以降のものだけ）
    for (const w of index.bySignature.get(vectorToSignature(cur)) || []) {
      const p = position.get(w);
      if (p === undefined || p < start) continue;
      record([...acc, w]);
      if (result.truncated) return;
    }
    if (slotsLeft === 1 || left < 2 * minLen) return;
    for (let k = 0; k < cands.length; k++) {
      const i = cands[k];
      const w = pool[i];
      // 残りを2語以上に分けるので、この語は残りの文字数から最小の長さを引いた長さまで
      if (w.length > left - minLen) continue;
      const next = subtract(cur, vec[i]);
      const rest = left - w.length;
      // 子があと1語しか選べないなら、子は署名を引くだけなので候補の絞り込みは要らない
      const from = opts.allowRepeat === false ? k + 1 : k;
      const sub = [];
      if (slotsLeft - 1 > 1) {
        for (let m = from; m < cands.length; m++) {
          const j = cands[m];
          if (pool[j].length <= rest && canCover(vec[j], next)) sub.push(j);
        }
      }
      acc.push(w);
      rec(next, sub, opts.allowRepeat === false ? i + 1 : i, rest, slotsLeft - 1);
      acc.pop();
      if (result.truncated) return;
    }
  };
  rec(have, pool.map((_, i) => i), 0, left0, slots);

  const shortest = (p) => Math.min(...p.words.map((w) => w.length));
  result.phrases.sort((a, b) => a.words.length - b.words.length || shortest(b) - shortest(a) || byWord(a.words.join(' '), b.words.join(' ')));
  return result;
}

// 2つの文字列の文字を比べる。アナグラムどうしか、どちらにだけある文字（とその数）、片方がもう片方の文字で作れるか
export function compareLetters(textA, textB) {
  const a = normalizeLetters(textA);
  const b = normalizeLetters(textB);
  const va = freqVector(a.letters);
  const vb = freqVector(b.letters);
  const onlyA = [];
  const onlyB = [];
  for (let i = 0; i < 26; i++) {
    if (va[i] > vb[i]) onlyA.push({ letter: ALPHABET[i], count: va[i] - vb[i] });
    if (vb[i] > va[i]) onlyB.push({ letter: ALPHABET[i], count: vb[i] - va[i] });
  }
  return {
    a, b,
    signatureA: vectorToSignature(va),
    signatureB: vectorToSignature(vb),
    isAnagram: a.letters.length > 0 && onlyA.length === 0 && onlyB.length === 0,
    onlyA, onlyB,
    aContainsB: canCover(vb, va),
    bContainsA: canCover(va, vb)
  };
}

// 書き出し用。CSV は Excel で文字化けしないよう BOM つき・CRLF、すべての欄を引用符で囲む
export function toCsv(header, rows) {
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
