// Anagram Hunter - by ipusiron
// MIT License
// 画面の処理（ES module）。探索のロジックは js/anagram-core.js、辞書の一覧は js/wordlists.js、文言は js/messages.js

import {
  normalizeLetters, parseWordList, buildIndex, readFilters, findSingle, findPairs, signature, toCsv, MAX_INPUT_LETTERS
} from './js/anagram-core.js';
import {
  BUILTIN_WORDS, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS, MAX_FILE_BYTES, MAX_DICTIONARY_WORDS, displayName
} from './js/wordlists.js';
import { t } from './js/messages.js';
import { initThemeToggle } from './js/theme.js';
import { initTabs } from './js/tabs.js';

// ===== Utilities =====
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n).toLocaleString();
const MAX_LIMIT = 10000;
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
  for (const node of [$('#dictNameSingle'), $('#dictNameTwoWord')]) node.textContent = loading ? `${text} ${t('dict.loading')}` : text;
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
    else if (!s.words) count = `${t('dict.words', { n: fmt(s.expected) })} ・ ${t('dict.notLoaded')}`;
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
// 入力欄から文字列・絞り込み・表示の上限を読む。誤りは { error } で返す
function readForm(ids) {
  const { letters, ignored } = normalizeLetters($(ids.letters).value);
  if (!letters) return { error: t('input.empty') };
  if (letters.length > MAX_INPUT_LETTERS) return { error: t('input.tooLong', { n: letters.length, limit: MAX_INPUT_LETTERS }) };
  // 数の欄に数でない文字（1e など）を打つと、ブラウザーは value を空にして badInput を立てる。空欄（制限なし）と区別する
  const num = (sel) => ($(sel).validity && $(sel).validity.badInput ? 'invalid' : $(sel).value);
  const f = readFilters({
    minLen: num(ids.minLen), maxLen: num(ids.maxLen),
    startsWith: $(ids.startsWith).value, endsWith: $(ids.endsWith).value, contains: $(ids.contains).value
  });
  if (!f.ok) return { error: t(`filter.${f.error}`, f) };
  const rawLimit = String(num(ids.limit)).trim();
  const limit = rawLimit === '' ? 200 : /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!(limit >= 1 && limit <= MAX_LIMIT)) return { error: t('limit.invalid', { limit: fmt(MAX_LIMIT) }) };
  if (!index.words.length) return { error: t('search.noDictionary') };
  return { letters, ignored, filters: f.filters, limit };
}

const SINGLE = {
  letters: '#letters', minLen: '#minLen', maxLen: '#maxLen', startsWith: '#startsWith', endsWith: '#endsWith', contains: '#contains',
  limit: '#limitSingle', status: '#statusSingle', summary: '#summarySingle', stale: '#staleSingle', info: '#resultInfoSingle',
  tbody: '#resultTableSingle tbody'
};
const PAIR = {
  letters: '#lettersTwoWord', minLen: '#minLenTwoWord', maxLen: '#maxLenTwoWord', startsWith: '#startsWithTwoWord',
  endsWith: '#endsWithTwoWord', contains: '#containsTwoWord', limit: '#topN', status: '#statusTwoWord', summary: '#summaryTwoWord',
  stale: '#staleTwoWord', info: '#resultInfoTwoWord', tbody: '#resultTableTwoWord tbody'
};
const state = { single: null, pair: null };

function clearResults(ids, key) {
  state[key] = null;
  $(ids.tbody).replaceChildren();
  $(ids.summary).textContent = '';
  $(ids.info).textContent = '';
  $(ids.stale).hidden = true;
}

// 辞書が変わったら、表示中の結果に「前の辞書の結果」と添える
function markStale() {
  for (const [key, ids] of [['single', SINGLE], ['pair', PAIR]]) {
    if (!state[key]) continue;
    const node = $(ids.stale);
    node.textContent = t('result.stale');
    node.hidden = false;
  }
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
async function init() {
  initThemeToggle($('#btnTheme'));
  initTabs($('.tab-nav'));
  bindEvents();
  rebuildIndex();
  document.documentElement.setAttribute('data-ready', 'true');
  if (IS_FILE) {
    const note = $('#dictProtocolNote');
    note.textContent = t('dict.fileProtocol');
    note.hidden = false;
    return;
  }
  // 一般的な英単語の付属辞書を最初から読み込む
  const defaults = sources.filter((s) => s.kind === 'bundled' && DEFAULT_WORDLISTS.includes(s.id));
  await Promise.all(defaults.map((s) => loadBundled(s)));
  rebuildIndex();
}

init();
