// Anagram Hunter - by ipusiron
// MIT License
// 画面の処理（ES module）。探索のロジックは js/anagram-core.js、辞書の一覧は js/wordlists.js、文言は js/messages.js

import {
  normalizeLetters, parseWordList, buildIndex, readFilters, findSingle, findPairs, findPhrases, signature, toCsv, MAX_INPUT_LETTERS,
  PHRASE_LIMITS, removeWord, compareLetters, freqVector
} from './js/anagram-core.js';
import {
  BUILTIN_WORDS, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS, MAX_FILE_BYTES, MAX_DICTIONARY_WORDS, displayName
} from './js/wordlists.js';
import { t } from './js/messages.js';
import { initThemeToggle } from './js/theme.js';
import { initTabs } from './js/tabs.js';
import { readParams } from './js/params.js';

// ===== Utilities =====
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n).toLocaleString();
const MAX_LIMIT = 10000;
// フレーズの探索を打ち切るまでの時間（ミリ秒）
const PHRASE_TIME_MS = 3000;
const IS_FILE = window.location.protocol === 'file:';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function setStatus(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle('error', isError);
}

// ===== Dictionary sources =====
// kind: builtin（内蔵）／bundled（付属、fetch で読む）／file（ファイル選択）／paste（貼り付け）
// words は正規化と重複除去のあとの配列。bundled は読み込むまで null
const sources = [
  { key: 'builtin', kind: 'builtin', name: t('dict.builtin'), words: BUILTIN_WORDS, lines: BUILTIN_WORDS.length, duplicates: 0, invalid: 0,
    enabled: true }
];
for (const w of BUNDLED_WORDLISTS) {
  sources.push({ key: `bundled:${w.id}`, kind: 'bundled', id: w.id, file: w.file, name: t(`dict.bundled.${w.id}`), words: null,
    expected: w.words, lines: w.lines, enabled: false, loading: false });
}
let pasteCount = 0;
let userCount = 0;
let index = buildIndex([]);

function enabledSources() {
  return sources.filter((s) => s.enabled && s.words);
}

function rebuildIndex(focusKey = null) {
  index = buildIndex(enabledSources().map((s) => s.words));
  $('#wordCount').textContent = fmt(index.words.length);
  $('#signatureCount').textContent = fmt(index.bySignature.size);
  const names = enabledSources().map((s) => s.name);
  const loading = sources.some((s) => s.loading);
  const text = names.length ? names.join(', ') : t('dict.none');
  for (const node of [$('#dictNameSingle'), $('#dictNameTwoWord'), $('#dictNamePhrase'), $('#dictNameBuilder')]) {
    node.textContent = loading ? `${text} ${t('dict.loading')}` : text;
  }
  markStale();
  renderDictionaryList(focusKey);
}

function kindLabel(s) {
  return t({ builtin: 'dict.kindBuiltin', bundled: 'dict.kindBundled', file: 'dict.kindFile', paste: 'dict.kindPaste' }[s.kind]);
}

// 語数の表示。重複や英字のない行を除いたときは、元の行数と除いた行数を添える
function wordCountText(s) {
  const removed = [];
  if (s.duplicates) removed.push(t('dict.removedDuplicates', { n: fmt(s.duplicates) }));
  if (s.invalid) removed.push(t('dict.removedInvalid', { n: fmt(s.invalid) }));
  if (!removed.length) return t('dict.words', { n: fmt(s.words.length) });
  return t('dict.wordsDetail', { n: fmt(s.words.length), lines: fmt(s.lines), removed: removed.join(t('dict.removedJoin')) });
}

// 一覧は描き直すので、フォーカスがあったチェックボックスは描き直したあとの同じ項目へ戻す（キーボードで操作を続けられるように）
function renderDictionaryList(focusKey = null) {
  const list = $('#dictListContainer');
  const active = document.activeElement;
  const keep = focusKey || (active && list.contains(active) && active.dataset.key) || null;
  list.replaceChildren();
  for (const s of sources) {
    const box = el('input', { type: 'checkbox', checked: s.enabled, disabled: s.loading || (s.kind === 'bundled' && IS_FILE) });
    box.dataset.key = s.key;
    let count;
    if (s.loading) count = t('dict.loading');
    else if (!s.words) count = t('dict.notLoaded', { n: fmt(s.expected) });
    else if (s.kind === 'builtin') count = t('dict.words', { n: fmt(s.words.length) });
    else count = wordCountText(s);
    const label = el('label', { class: 'dict-checkbox' }, [box, el('span', { class: 'dict-item-name', text: s.name })]);
    const item = el('li', { class: 'dict-item' }, [
      label,
      el('span', { class: 'dict-item-kind', text: kindLabel(s) }),
      el('span', { class: 'dict-item-count', text: count })
    ]);
    if (s.kind === 'file' || s.kind === 'paste') {
      const remove = el('button', { type: 'button', class: 'btn btn-ghost btn-small', text: t('dict.remove') });
      remove.dataset.remove = s.key;
      remove.setAttribute('aria-label', t('dict.removeLabel', { name: s.name }));
      item.append(remove);
    }
    list.append(item);
  }
  if (keep) {
    const again = [...list.querySelectorAll('input[data-key]')].find((x) => x.dataset.key === keep);
    if (again) again.focus();
  }
}

async function loadBundled(source) {
  source.loading = true;
  rebuildIndex();
  try {
    const resp = await fetch(source.file);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const parsed = parseWordList(await resp.text());
    Object.assign(source, { words: parsed.words, lines: parsed.lines, duplicates: parsed.duplicates, invalid: parsed.invalid, enabled: true });
    return true;
  } catch (e) {
    source.enabled = false;
    setStatus($('#dictStatus'), t('dict.errorFetch', { name: source.name, detail: e.message }), true);
    return false;
  } finally {
    source.loading = false;
  }
}

async function toggleSource(key, on) {
  const s = sources.find((x) => x.key === key);
  if (!s) return;
  if (on && !s.words && s.kind === 'bundled') {
    const ok = await loadBundled(s);
    rebuildIndex(key);
    if (ok) setStatus($('#dictStatus'), t('dict.statusLoaded', { name: s.name, n: fmt(s.words.length), total: fmt(index.words.length) }));
    return;
  }
  s.enabled = on;
  rebuildIndex();
  setStatus($('#dictStatus'), t('dict.statusToggled', { total: fmt(index.words.length) }));
}

// 利用者の辞書を足す。同じ名前があれば中身を置き換える（使う／使わないの状態は引き継ぐ）
function addUserDictionary(kind, name, text) {
  const parsed = parseWordList(text);
  if (!parsed.words.length) return setStatus($('#dictStatus'), t('dict.errorEmpty'), true);
  if (parsed.words.length > MAX_DICTIONARY_WORDS) {
    return setStatus($('#dictStatus'), t('dict.errorTooManyWords', { n: fmt(parsed.words.length), limit: fmt(MAX_DICTIONARY_WORDS) }), true);
  }
  const existing = sources.find((s) => (s.kind === 'file' || s.kind === 'paste') && s.name === name);
  const fields = { words: parsed.words, lines: parsed.lines, duplicates: parsed.duplicates, invalid: parsed.invalid };
  if (existing) {
    Object.assign(existing, fields);
  } else {
    userCount += 1;
    sources.push({ key: `${kind}:${userCount}`, kind, name, enabled: true, ...fields });
  }
  rebuildIndex();
  const msg = existing ? 'dict.statusReplaced' : 'dict.statusLoaded';
  setStatus($('#dictStatus'), t(msg, { name, n: fmt(parsed.words.length), total: fmt(index.words.length) }));
}

function formatBytes(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`;
}

// ===== Search =====
// 数の欄に数でない文字（1e など）を打つと、ブラウザーは value を空にして badInput を立てる。空欄（制限なし）と区別する
function num(sel) {
  return sel ? ($(sel).validity && $(sel).validity.badInput ? 'invalid' : $(sel).value) : '';
}

// 表示の上限。空欄は200、1〜MAX_LIMIT の整数でなければ NaN
function readLimit(sel) {
  const raw = String(num(sel)).trim();
  const limit = raw === '' ? 200 : /^\d+$/.test(raw) ? Number(raw) : NaN;
  return limit >= 1 && limit <= MAX_LIMIT ? limit : NaN;
}

// 入力欄から文字列・絞り込み・表示の上限を読む。誤りは { error } で返す
function readForm(ids) {
  const { letters, ignored } = normalizeLetters($(ids.letters).value);
  if (!letters) return { error: t('input.empty') };
  if (letters.length > MAX_INPUT_LETTERS) return { error: t('input.tooLong', { n: letters.length, limit: MAX_INPUT_LETTERS }) };
  const text = (sel) => (sel ? $(sel).value : '');
  const f = readFilters({
    minLen: num(ids.minLen), maxLen: num(ids.maxLen),
    startsWith: text(ids.startsWith), endsWith: text(ids.endsWith), contains: text(ids.contains), pattern: text(ids.pattern)
  });
  if (!f.ok) return { error: t(`filter.${f.error}`, f) };
  const limit = readLimit(ids.limit);
  if (Number.isNaN(limit)) return { error: t('limit.invalid', { limit: fmt(MAX_LIMIT) }) };
  if (!index.words.length) return { error: t('search.noDictionary') };
  return { letters, ignored, filters: f.filters, limit };
}

const SINGLE = {
  letters: '#letters', minLen: '#minLen', maxLen: '#maxLen', startsWith: '#startsWith', endsWith: '#endsWith', contains: '#contains',
  pattern: '#patternSingle', limit: '#limitSingle', status: '#statusSingle', summary: '#summarySingle', stale: '#staleSingle', info: '#resultInfoSingle',
  tbody: '#resultTableSingle tbody'
};
const PAIR = {
  letters: '#lettersTwoWord', minLen: '#minLenTwoWord', maxLen: '#maxLenTwoWord', startsWith: '#startsWithTwoWord',
  endsWith: '#endsWithTwoWord', contains: '#containsTwoWord', limit: '#topN', status: '#statusTwoWord', summary: '#summaryTwoWord',
  stale: '#staleTwoWord', info: '#resultInfoTwoWord', tbody: '#resultTableTwoWord tbody'
};
const PHRASE = {
  letters: '#lettersPhrase', minLen: '#minLenPhrase', maxLen: '#maxLenPhrase', limit: '#limitPhrase', status: '#statusPhrase',
  summary: '#summaryPhrase', stale: '#stalePhrase', info: '#resultInfoPhrase', tbody: '#resultTablePhrase tbody'
};
const state = { single: null, pair: null, phrase: null };

function clearResults(ids, key) {
  state[key] = null;
  $(ids.tbody).replaceChildren();
  $(ids.summary).textContent = '';
  $(ids.info).textContent = '';
  $(ids.stale).hidden = true;
}

// 辞書が変わったら、表示中の結果に「前の辞書の結果」と添える
function markStale() {
  for (const [key, ids] of [['single', SINGLE], ['pair', PAIR], ['phrase', PHRASE]]) {
    if (!state[key]) continue;
    const node = $(ids.stale);
    node.textContent = t('result.stale');
    node.hidden = false;
  }
  // 組み立ては、選んだ語を保ったまま新しい辞書で候補を出し直す
  if (builder.letters) renderBuilder();
}

function lookupLink(query) {
  const a = el('a', { href: `https://eow.alc.co.jp/search?q=${encodeURIComponent(query)}`, target: '_blank', rel: 'noopener noreferrer',
    class: 'dict-link', text: '🔍' });
  a.setAttribute('aria-label', t('result.lookup', { word: query }));
  a.title = t('result.lookup', { word: query });
  return a;
}

function runSingle() {
  const status = $(SINGLE.status);
  const form = readForm(SINGLE);
  if (form.error) {
    clearResults(SINGLE, 'single');
    return setStatus(status, form.error, true);
  }
  const results = findSingle(index, form.letters, form.filters);
  state.single = { ...form, results };
  $(SINGLE.stale).hidden = true;
  const exact = results.filter((r) => r.kind === 'exact').length;
  $(SINGLE.summary).textContent = t('result.singleSummary', {
    letters: form.letters, len: form.letters.length, sig: signature(form.letters), exact: fmt(exact), partial: fmt(results.length - exact)
  });
  setStatus(status, form.ignored ? t('input.ignored', { n: form.ignored }) : '');
  renderSingle();
}

function visibleSingle() {
  if (!state.single) return [];
  return $('#showPartialSingle').checked ? state.single.results : state.single.results.filter((r) => r.kind === 'exact');
}

function renderSingle() {
  const tbody = $(SINGLE.tbody);
  tbody.replaceChildren();
  if (!state.single) return;
  const rows = visibleSingle();
  const shown = rows.slice(0, state.single.limit);
  const frag = document.createDocumentFragment();
  shown.forEach((r, i) => {
    frag.append(el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td', {}, [el('code', { text: r.word })]),
      el('td', { text: t(`kind.${r.kind}`) }),
      el('td', { text: String(r.word.length) }),
      el('td', {}, [r.rest ? el('code', { text: r.rest }) : t('result.restNone')]),
      el('td', {}, [lookupLink(r.word)])
    ]));
  });
  tbody.append(frag);
  const hiddenPartial = state.single.results.length - rows.length;
  let info = rows.length === 0 ? t('result.none')
    : shown.length < rows.length ? t('result.shown', { total: fmt(rows.length), shown: fmt(shown.length) })
      : t('result.shownAll', { total: fmt(rows.length) });
  if (hiddenPartial > 0) info += t('result.hiddenPartial', { n: fmt(hiddenPartial) });
  $(SINGLE.info).textContent = info;
}

function runPair() {
  const status = $(PAIR.status);
  const form = readForm(PAIR);
  if (form.error) {
    clearResults(PAIR, 'pair');
    return setStatus(status, form.error, true);
  }
  const { pairs, firstCandidates } = findPairs(index, form.letters, form.filters);
  state.pair = { ...form, pairs };
  $(PAIR.stale).hidden = true;
  $(PAIR.summary).textContent = t('result.pairSummary', {
    letters: form.letters, len: form.letters.length, sig: signature(form.letters), pairs: fmt(pairs.length), first: fmt(firstCandidates)
  });
  setStatus(status, form.ignored ? t('input.ignored', { n: form.ignored }) : '');
  renderPair();
}

function renderPair() {
  const tbody = $(PAIR.tbody);
  tbody.replaceChildren();
  if (!state.pair) return;
  const { pairs, limit } = state.pair;
  const shown = pairs.slice(0, limit);
  const frag = document.createDocumentFragment();
  shown.forEach((p, i) => {
    const phrase = p.words.join(' ');
    frag.append(el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td', {}, [el('code', { text: phrase })]),
      el('td', { text: t('result.pairLengths', { a: p.words[0].length, b: p.words[1].length }) }),
      el('td', {}, [lookupLink(phrase)])
    ]));
  });
  tbody.append(frag);
  $(PAIR.info).textContent = pairs.length === 0 ? t('result.none')
    : shown.length < pairs.length ? t('result.shown', { total: fmt(pairs.length), shown: fmt(shown.length) })
      : t('result.shownAll', { total: fmt(pairs.length) });
}

// 必ず含める語・使わない語の欄: 空白か「,」「、」で区切り、英字だけに直す
function readWordList(sel) {
  return $(sel).value.split(/[\s,\u3001\uff0c]+/).map((w) => normalizeLetters(w).letters).filter(Boolean);
}

function runPhrase() {
  const status = $(PHRASE.status);
  const form = readForm(PHRASE);
  if (form.error) {
    clearResults(PHRASE, 'phrase');
    $('#truncatedPhrase').hidden = true;
    return setStatus(status, form.error, true);
  }
  setStatus(status, t('phrase.searching'));
  $('#runPhraseBtn').disabled = true;
  // 「探索中」を画面に出してから探す（長い入力では数秒かかることがある）
  setTimeout(() => {
    try {
      const r = findPhrases(index, form.letters, form.filters, {
        maxWords: Number($('#maxWordsPhrase').value), include: readWordList('#includePhrase'), exclude: readWordList('#excludePhrase'),
        allowRepeat: $('#allowRepeatPhrase').checked, limit: PHRASE_LIMITS.results, steps: PHRASE_LIMITS.steps, timeMs: PHRASE_TIME_MS
      });
      if (!r.ok) {
        clearResults(PHRASE, 'phrase');
        $('#truncatedPhrase').hidden = true;
        return setStatus(status, t(`phrase.${r.error}`, r), true);
      }
      state.phrase = { ...form, phrases: r.phrases };
      $(PHRASE.stale).hidden = true;
      $(PHRASE.summary).textContent = t('result.phraseSummary', {
        letters: form.letters, len: form.letters.length, sig: signature(form.letters), n: fmt(r.phrases.length),
        candidates: fmt(r.candidates), steps: fmt(r.steps)
      });
      const note = $('#truncatedPhrase');
      note.hidden = !r.truncated;
      note.textContent = r.truncated ? t(`phrase.truncated.${r.truncated}`, { limit: fmt(PHRASE_LIMITS.results) }) : '';
      setStatus(status, form.ignored ? t('input.ignored', { n: form.ignored }) : '');
      renderPhrase();
    } finally {
      $('#runPhraseBtn').disabled = false;
    }
  }, 0);
}

function renderPhrase() {
  const tbody = $(PHRASE.tbody);
  tbody.replaceChildren();
  if (!state.phrase) return;
  const { phrases, limit } = state.phrase;
  const shown = phrases.slice(0, limit);
  const frag = document.createDocumentFragment();
  shown.forEach((p, i) => {
    const phrase = p.words.join(' ');
    frag.append(el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td', {}, [el('code', { text: phrase })]),
      el('td', { text: String(p.words.length) }),
      el('td', { text: p.words.map((w) => w.length).join(t('result.lengthJoin')) }),
      el('td', {}, [lookupLink(phrase)])
    ]));
  });
  tbody.append(frag);
  $(PHRASE.info).textContent = phrases.length === 0 ? t('result.none')
    : shown.length < phrases.length ? t('result.shown', { total: fmt(phrases.length), shown: fmt(shown.length) })
      : t('result.shownAll', { total: fmt(phrases.length) });
}

// ===== Builder（1語ずつ選んで残りを詰める） =====
const builder = { letters: '', chosen: [], minLen: 3, limit: 200 };

function builderRest() {
  // 残りの文字は、選ぶ前から ABC 順（署名の形）で表す
  return builder.chosen.reduce((rest, w) => removeWord(rest, w), signature(builder.letters));
}

function startBuilder() {
  const status = $('#statusBuilder');
  const { letters, ignored } = normalizeLetters($('#lettersBuilder').value);
  const f = readFilters({ minLen: num('#minLenBuilder') });
  const limit = readLimit('#limitBuilder');
  let error = null;
  if (!letters) error = t('input.empty');
  else if (letters.length > MAX_INPUT_LETTERS) error = t('input.tooLong', { n: letters.length, limit: MAX_INPUT_LETTERS });
  else if (!f.ok) error = t(`filter.${f.error}`, f);
  else if (Number.isNaN(limit)) error = t('limit.invalid', { limit: fmt(MAX_LIMIT) });
  else if (!index.words.length) error = t('search.noDictionary');
  if (error) {
    Object.assign(builder, { letters: '', chosen: [] });
    renderBuilder();
    return setStatus(status, error, true);
  }
  Object.assign(builder, { letters, chosen: [], minLen: f.filters.minLen, limit });
  setStatus(status, ignored ? t('input.ignored', { n: ignored }) : '');
  renderBuilder();
}

function renderBuilder(focusFirst = false) {
  const tbody = $('#resultTableBuilder tbody');
  tbody.replaceChildren();
  const tiles = $('#builderTiles');
  tiles.replaceChildren();
  const done = $('#builderDone');
  done.hidden = true;
  $('#builderUndoBtn').disabled = !builder.chosen.length;
  $('#builderResetBtn').disabled = !builder.chosen.length;
  if (!builder.letters) {
    $('#builderChosen').textContent = '';
    $('#builderRest').textContent = '';
    $('#resultInfoBuilder').textContent = '';
    return;
  }
  const rest = builderRest();
  $('#builderChosen').textContent = builder.chosen.length ? builder.chosen.join(' ') : t('builder.noneChosen');
  $('#builderRest').textContent = rest ? t('builder.rest', { rest, n: rest.length }) : t('result.restNone');
  freqVector(rest).forEach((n, i) => {
    if (n) tiles.append(el('li', { class: 'letter-tile', text: t('builder.tile', { letter: String.fromCharCode(65 + i), n }) }));
  });
  if (!rest) {
    done.textContent = t('builder.done', { phrase: builder.chosen.join(' ') });
    done.hidden = false;
    $('#resultInfoBuilder').textContent = '';
    if (focusFirst) $('#builderUndoBtn').focus();
    return;
  }
  const filters = readFilters({ minLen: String(builder.minLen) }).filters;
  // 候補: 残りの文字で作れる語。残りを使い切る語、あと1語で完成する語、長い語の順
  const rows = findSingle(index, rest, filters).map((r) => ({
    ...r, finish: r.rest ? (index.bySignature.get(r.rest) || []).filter((w) => w.length >= builder.minLen) : []
  }));
  const rank = (r) => (r.kind === 'exact' ? 0 : r.finish.length ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || b.word.length - a.word.length || (a.word < b.word ? -1 : 1));
  const shown = rows.slice(0, builder.limit);
  const frag = document.createDocumentFragment();
  for (const r of shown) {
    const pick = el('button', { type: 'button', class: 'word-btn', text: r.word });
    pick.dataset.word = r.word;
    pick.setAttribute('aria-label', t('builder.pick', { word: r.word }));
    const more = r.finish.length > 3 ? t('builder.more', { n: r.finish.length - 3 }) : '';
    frag.append(el('tr', {}, [
      el('td', {}, [pick]),
      el('td', { text: String(r.word.length) }),
      el('td', {}, [r.rest ? el('code', { text: r.rest }) : t('builder.completes')]),
      el('td', { text: r.finish.slice(0, 3).join(', ') + more })
    ]));
  }
  tbody.append(frag);
  $('#resultInfoBuilder').textContent = rows.length === 0 ? t('builder.noCandidates')
    : shown.length < rows.length ? t('result.shown', { total: fmt(rows.length), shown: fmt(shown.length) })
      : t('result.shownAll', { total: fmt(rows.length) });
  if (focusFirst) (tbody.querySelector('button') || $('#builderUndoBtn')).focus();
}

// ===== Compare（2つの文字列） =====
function runCompare() {
  const status = $('#statusCompare');
  const r = compareLetters($('#compareA').value, $('#compareB').value);
  const tbody = $('#resultTableCompare tbody');
  tbody.replaceChildren();
  const verdict = $('#compareVerdict');
  if (!r.a.letters || !r.b.letters) {
    verdict.textContent = '';
    $('#compareDetail').textContent = '';
    return setStatus(status, t('compare.empty'), true);
  }
  const ignored = r.a.ignored + r.b.ignored;
  setStatus(status, ignored ? t('input.ignored', { n: ignored }) : '');
  verdict.textContent = t(r.isAnagram ? 'compare.yes' : 'compare.no');
  verdict.classList.toggle('ok', r.isAnagram);
  const parts = [t('compare.signatures', { a: r.signatureA, b: r.signatureB, la: r.a.letters.length, lb: r.b.letters.length })];
  const list = (items) => items.map((x) => t('builder.tile', { letter: x.letter, n: x.count })).join(t('compare.join'));
  if (!r.isAnagram) {
    if (r.onlyA.length) parts.push(t('compare.onlyA', { list: list(r.onlyA) }));
    if (r.onlyB.length) parts.push(t('compare.onlyB', { list: list(r.onlyB) }));
    if (r.aContainsB) parts.push(t('compare.aContainsB'));
    else if (r.bContainsA) parts.push(t('compare.bContainsA'));
  }
  $('#compareDetail').textContent = parts.join(' ');
  const va = freqVector(r.a.letters);
  const vb = freqVector(r.b.letters);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 26; i++) {
    if (!va[i] && !vb[i]) continue;
    const d = va[i] - vb[i];
    frag.append(el('tr', d ? { class: 'diff' } : {}, [
      el('td', {}, [el('code', { text: String.fromCharCode(65 + i) })]),
      el('td', { text: String(va[i]) }),
      el('td', { text: String(vb[i]) }),
      el('td', { text: d === 0 ? '0' : d > 0 ? t('compare.moreA', { n: d }) : t('compare.moreB', { n: -d }) })
    ]));
  }
  tbody.append(frag);
}

// ===== Export =====
function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// 書き出しは表示の上限に関係なく全件（1語は「一部の文字を使う語も表示」の状態に合わせる）
function singleRecords() {
  return visibleSingle().map((r, i) => ({ rank: i + 1, candidate: r.word, type: r.kind, length: r.word.length, remaining: r.rest }));
}

function pairRecords() {
  return (state.pair ? state.pair.pairs : []).map((p, i) => ({
    rank: i + 1, candidate: p.words.join(' '), word1: p.words[0], word2: p.words[1], length: p.length
  }));
}

function phraseRecords() {
  return (state.phrase ? state.phrase.phrases : []).map((p, i) => ({
    rank: i + 1, candidate: p.words.join(' '), words: p.words.length, lengths: p.words.map((w) => w.length).join('+')
  }));
}

function exportRecords(records, base, format, status) {
  if (!records.length) return setStatus($(status), t('export.nothing'), true);
  if (format === 'csv') {
    const header = Object.keys(records[0]);
    download(toCsv(header, records.map((r) => header.map((k) => r[k]))), `${base}.csv`, 'text/csv;charset=utf-8');
  } else {
    download(`${JSON.stringify(records, null, 2)}\n`, `${base}.json`, 'application/json');
  }
}

// ===== Events =====
function bindEvents() {
  $('#formSingle').addEventListener('submit', (e) => {
    e.preventDefault();
    runSingle();
  });
  $('#clearBtn').addEventListener('click', () => {
    $('#letters').value = '';
    setStatus($(SINGLE.status), '');
    clearResults(SINGLE, 'single');
    $('#letters').focus();
  });
  $('#showPartialSingle').addEventListener('change', renderSingle);
  $('#exportCsvSingleBtn').addEventListener('click', () => exportRecords(singleRecords(), 'single_anagram_results', 'csv', SINGLE.status));
  $('#exportJsonSingleBtn').addEventListener('click', () => exportRecords(singleRecords(), 'single_anagram_results', 'json', SINGLE.status));

  $('#formTwoWord').addEventListener('submit', (e) => {
    e.preventDefault();
    runPair();
  });
  $('#clearTwoWordBtn').addEventListener('click', () => {
    $('#lettersTwoWord').value = '';
    setStatus($(PAIR.status), '');
    clearResults(PAIR, 'pair');
    $('#lettersTwoWord').focus();
  });
  $('#exportCsvTwoWordBtn').addEventListener('click', () => exportRecords(pairRecords(), 'two_word_anagram_results', 'csv', PAIR.status));
  $('#exportJsonTwoWordBtn').addEventListener('click', () => exportRecords(pairRecords(), 'two_word_anagram_results', 'json', PAIR.status));

  $('#formPhrase').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!$('#runPhraseBtn').disabled) runPhrase();
  });
  $('#clearPhraseBtn').addEventListener('click', () => {
    $('#lettersPhrase').value = '';
    setStatus($(PHRASE.status), '');
    clearResults(PHRASE, 'phrase');
    $('#truncatedPhrase').hidden = true;
    $('#lettersPhrase').focus();
  });
  $('#exportCsvPhraseBtn').addEventListener('click', () => exportRecords(phraseRecords(), 'phrase_anagram_results', 'csv', PHRASE.status));
  $('#exportJsonPhraseBtn').addEventListener('click', () => exportRecords(phraseRecords(), 'phrase_anagram_results', 'json', PHRASE.status));

  $('#formBuilder').addEventListener('submit', (e) => {
    e.preventDefault();
    startBuilder();
  });
  $('#clearBuilderBtn').addEventListener('click', () => {
    $('#lettersBuilder').value = '';
    setStatus($('#statusBuilder'), '');
    Object.assign(builder, { letters: '', chosen: [] });
    renderBuilder();
    $('#lettersBuilder').focus();
  });
  $('#resultTableBuilder').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-word]');
    if (!button || !builder.letters) return;
    builder.chosen.push(button.dataset.word);
    renderBuilder(true);
  });
  $('#builderUndoBtn').addEventListener('click', () => {
    builder.chosen.pop();
    renderBuilder(true);
  });
  $('#builderResetBtn').addEventListener('click', () => {
    builder.chosen = [];
    renderBuilder(true);
  });

  $('#formCompare').addEventListener('submit', (e) => {
    e.preventDefault();
    runCompare();
  });
  $('#clearCompareBtn').addEventListener('click', () => {
    $('#compareA').value = '';
    $('#compareB').value = '';
    setStatus($('#statusCompare'), '');
    $('#compareVerdict').textContent = '';
    $('#compareDetail').textContent = '';
    $('#resultTableCompare tbody').replaceChildren();
    $('#compareA').focus();
  });

  // 辞書の一覧（項目は描き直すので、親で受ける）
  $('#dictListContainer').addEventListener('change', (e) => {
    const key = e.target.dataset && e.target.dataset.key;
    if (key) toggleSource(key, e.target.checked);
  });
  $('#dictListContainer').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-remove]');
    if (!button) return;
    const i = sources.findIndex((s) => s.key === button.dataset.remove);
    if (i < 0) return;
    const [removed] = sources.splice(i, 1);
    rebuildIndex();
    // 外した項目の位置にある項目（なければ1つ前）へフォーカスを移す
    const next = sources[Math.min(i, sources.length - 1)];
    if (next) renderDictionaryList(next.key);
    setStatus($('#dictStatus'), t('dict.statusRemoved', { name: removed.name, total: fmt(index.words.length) }));
  });

  $('#loadWordlistBtn').addEventListener('click', async () => {
    const input = $('#wordlistFile');
    const file = input.files && input.files[0];
    if (!file) return setStatus($('#dictStatus'), t('dict.errorNoFile'), true);
    if (file.size > MAX_FILE_BYTES) {
      return setStatus($('#dictStatus'), t('dict.errorTooLarge', { size: formatBytes(file.size), limit: formatBytes(MAX_FILE_BYTES) }), true);
    }
    try {
      addUserDictionary('file', displayName(file.name) || 'wordlist.txt', await file.text());
      input.value = '';
    } catch (e) {
      setStatus($('#dictStatus'), t('dict.errorRead', { detail: e.message }), true);
    }
  });

  $('#addPastedBtn').addEventListener('click', () => {
    const area = $('#pasteWords');
    if (!area.value.trim()) return setStatus($('#dictStatus'), t('dict.errorPasteEmpty'), true);
    pasteCount += 1;
    addUserDictionary('paste', t('dict.pasted', { n: pasteCount }), area.value);
    area.value = '';
  });
}

// ===== Init =====
// ?text=…&tab=… で渡された文字列を、そのタブの入力欄に入れて実行する（辞書の読み込みのあと）
const PARAM_TARGETS = {
  single: ['#letters', runSingle],
  'two-word': ['#lettersTwoWord', runPair],
  phrase: ['#lettersPhrase', runPhrase],
  builder: ['#lettersBuilder', startBuilder],
  compare: ['#compareA', runCompare]
};

function applyParams(tabs) {
  const { text, tab } = readParams(window.location.search);
  if (!text) return;
  const [input, run] = PARAM_TARGETS[tab];
  $(input).value = text;
  tabs.select(tab);
  if (tab !== 'compare') run();
}

async function init() {
  initThemeToggle($('#btnTheme'));
  const tabs = initTabs($('.tab-nav'));
  bindEvents();
  rebuildIndex();
  renderBuilder();
  document.documentElement.setAttribute('data-ready', 'true');
  if (IS_FILE) {
    const note = $('#dictProtocolNote');
    note.textContent = t('dict.fileProtocol');
    note.hidden = false;
    applyParams(tabs);
    return;
  }
  // 一般的な英単語の付属辞書を最初から読み込む
  const defaults = sources.filter((s) => s.kind === 'bundled' && DEFAULT_WORDLISTS.includes(s.id));
  await Promise.all(defaults.map((s) => loadBundled(s)));
  rebuildIndex();
  applyParams(tabs);
}

init();
