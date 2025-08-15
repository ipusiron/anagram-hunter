// Anagram Hunter - by ipusiron (project scaffold)
// MIT License

// ===== Utilities =====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function sanitizeLetters(s) {
  return (s || "").toUpperCase().replace(/[^A-Z]/g, "");
}

function freqVecFromString(s) {
  const v = new Array(26).fill(0);
  for (const ch of s) {
    const i = ch.charCodeAt(0) - 65;
    if (i >= 0 && i < 26) v[i]++;
  }
  return v;
}

function canCover(need, have) {
  // need <= have (component-wise)
  for (let i = 0; i < 26; i++) if (need[i] > have[i]) return false;
  return true;
}

function subVec(a, b) {
  const out = new Array(26);
  for (let i = 0; i < 26; i++) out[i] = a[i] - b[i];
  return out;
}

function isZeroVec(v) {
  for (let i = 0; i < 26; i++) if (v[i] !== 0) return false;
  return true;
}

function toSignature(s) {
  return s.split("").sort().join("");
}

// ===== Dictionary structures =====
// We keep both: signature map and freq cache
let WORDS = [];                // normalized words
let SIG2WORDS = new Map();     // signature(string) -> string[]
let WORD_FREQ = new Map();     // word -> 26-dim freq vector (cached)
let DICT_LOADED_DESC = "辞書：内蔵ミニ辞書（非常に小）";

function buildDictStructures(list) {
  WORDS = [];
  SIG2WORDS.clear();
  WORD_FREQ.clear();

  const seen = new Set();
  for (const raw of list) {
    const w = sanitizeLetters(raw);
    if (!w) continue;
    if (seen.has(w)) continue;
    seen.add(w);

    WORDS.push(w);

    const sig = toSignature(w);
    if (!SIG2WORDS.has(sig)) SIG2WORDS.set(sig, []);
    SIG2WORDS.get(sig).push(w);

    WORD_FREQ.set(w, freqVecFromString(w));
  }
}

function loadWordlistFromText(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  buildDictStructures(lines);
  DICT_LOADED_DESC = `辞書：${WORDS.length.toLocaleString()}語を読み込み`;
  $("#dictStatus").textContent = DICT_LOADED_DESC;
}

// Tiny built-in demo words (very small)
const MINI_WORDS = [
  "LISTEN","SILENT","ENLIST","INLETS",
  "STONE","NOTES","TONES",
  "APPLE","PEAL","PALE","LEAP","PEAL","PLEA",
  "TEAM","MEAT","MATE","TAME",
  "RATE","TEAR","TARE"
];
buildDictStructures(MINI_WORDS);

// ===== Filters =====
function buildFilters() {
  const minLen = Math.max(1, parseInt($("#minLen").value, 10) || 1);
  const maxLen = Math.max(minLen, parseInt($("#maxLen").value, 10) || 99);
  const mustInclude = sanitizeLetters($("#mustInclude").value);
  const mustExclude = sanitizeLetters($("#mustExclude").value);
  const sw = sanitizeLetters($("#startsWith").value);
  const ew = sanitizeLetters($("#endsWith").value);
  const contains = sanitizeLetters($("#contains").value);

  return {
    minLen, maxLen, mustInclude, mustExclude, sw, ew, contains
  };
}

function passFilters(word, f) {
  if (word.length < f.minLen || word.length > f.maxLen) return false;

  // include
  for (const c of f.mustInclude) {
    if (!word.includes(c)) return false;
  }
  // exclude
  for (const c of f.mustExclude) {
    if (word.includes(c)) return false;
  }
  // startsWith (simple literal, uppercase)
  if (f.sw && !word.startsWith(f.sw)) return false;
  // endsWith
  if (f.ew && !word.endsWith(f.ew)) return false;
  // contains
  if (f.contains && !word.includes(f.contains)) return false;

  return true;
}

// ===== Single-word anagram =====
function anagramsOneWord(letters, filters) {
  // Using signature first for exact-length matches:
  const sig = toSignature(letters);
  const exactList = SIG2WORDS.get(sig) || [];
  const outExact = exactList.filter(w => passFilters(w, filters));

  // For variable-length (sub-anagrams), do a cover check using frequency:
  const have = freqVecFromString(letters);
  const outSub = [];
  for (const w of WORDS) {
    const fv = WORD_FREQ.get(w);
    if (!canCover(fv, have)) continue;
    if (!passFilters(w, filters)) continue;
    outSub.push(w);
  }

  // Combine and unique; annotate type
  const set = new Set();
  const res = [];

  for (const w of outExact) {
    if (!set.has(w)) { res.push({ kind: "1語(完全変位)", word: w }); set.add(w); }
  }
  for (const w of outSub) {
    if (!set.has(w)) { res.push({ kind: "1語(部分使用)", word: w }); set.add(w); }
  }

  // Sort: exact first, then length desc, then lex
  res.sort((a,b) => {
    const rk = (a.kind === "1語(完全変位)" ? 0 : 1) - (b.kind === "1語(完全変位)" ? 0 : 1);
    if (rk !== 0) return rk;
    const dl = b.word.length - a.word.length;
    if (dl !== 0) return dl;
    return a.word.localeCompare(b.word);
  });
  return res;
}

// ===== Two-word anagram (educational MVP) =====
function anagramsTwoWords(letters, filters, beamWidth = 200, topN = 200) {
  const have = freqVecFromString(letters);

  // Step 1: candidate1 filter by cover and filters
  const cand1 = [];
  for (const w of WORDS) {
    const fv = WORD_FREQ.get(w);
    if (!canCover(fv, have)) continue;
    if (!passFilters(w, filters)) continue;
    cand1.push(w);
  }

  // Light scoring: prefer longer words first (heuristic)
  cand1.sort((a,b) => b.length - a.length || a.localeCompare(b));
  const beams = cand1.slice(0, beamWidth);

  // Step 2: for each beam, try to complete with word2
  const results = [];
  outer:
  for (const w1 of beams) {
    const rem = subVec(have, WORD_FREQ.get(w1));
    // fast upper bound: rem length
    const remLen = rem.reduce((s,x) => s + x, 0);

    for (const w2 of WORDS) {
      if (w2 === w1) { /* allow same word only if fits twice? */ }
      const fv2 = WORD_FREQ.get(w2);
      if (!canCover(fv2, rem)) continue;
      if (!passFilters(w2, filters)) continue;

      const rem2 = subVec(rem, fv2);
      if (!isZeroVec(rem2)) continue; // require exact cover for 2語完全変位

      // Found pair
      const pair = [w1, w2].sort(); // canonical
      const key = pair.join(" ");
      results.push({ kind: "2語(完全変位)", pair, len: pair[0].length + pair[1].length });
      if (results.length >= topN) break outer;
    }
  }

  // Unique + sort: by total length desc, then lex
  const uniq = new Map();
  for (const r of results) {
    uniq.set(r.pair.join(" "), r);
  }
  const out = Array.from(uniq.values());
  out.sort((a,b) => b.len - a.len || a.pair.join(" ").localeCompare(b.pair.join(" ")));
  return out;
}

// ===== Results table & export =====
function showResults(single, pairs) {
  const tbody = $("#resultTable tbody");
  tbody.innerHTML = "";
  let rank = 1;

  for (const r of single) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rank++}</td>
      <td><code>${r.word}</code></td>
      <td>${r.kind}</td>
      <td>${r.word.length}</td>
    `;
    tbody.appendChild(tr);
  }

  for (const r of pairs) {
    const display = r.pair.join(" ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rank++}</td>
      <td><code>${display}</code></td>
      <td>${r.kind}</td>
      <td>${r.len}</td>
    `;
    tbody.appendChild(tr);
  }

  $("#resultInfo").textContent = `1語: ${single.length} 件 / 2語: ${pairs.length} 件`;
}

function exportCSV() {
  const rows = [];
  $$("#resultTable tbody tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    rows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText, tds[3].innerText]);
  });
  const header = "rank,candidate,type,length\n";
  const body = rows.map(r => r.map(x => `"${x.replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "anagram_results.csv"; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON() {
  const data = [];
  $$("#resultTable tbody tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    data.push({
      rank: Number(tds[0].innerText),
      candidate: tds[1].innerText,
      type: tds[2].innerText,
      length: Number(tds[3].innerText)
    });
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "anagram_results.json"; a.click();
  URL.revokeObjectURL(url);
}

// ===== Events =====
function bindEvents() {
  $("#normalizeBtn").addEventListener("click", () => {
    const s = sanitizeLetters($("#letters").value);
    $("#letters").value = s;
  });

  $("#clearBtn").addEventListener("click", () => {
    $("#letters").value = "";
    $("#status").textContent = "";
    $("#resultInfo").textContent = "";
    $("#resultTable tbody").innerHTML = "";
  });

$("#runBtn").addEventListener("click", () => {
  $("#status").textContent = "探索中...";
  setTimeout(() => {
    try {
      const letters = sanitizeLetters($("#letters").value);
      if (!letters) throw new Error("文字列を入力してください（A–Z）");

      const filters = buildFilters();

      // --- 追加: 長すぎチェック ---
      // 1語アナグラムの場合
      if (!$("#twoWordMode").checked && letters.length > filters.maxLen) {
        throw new Error(`入力が長すぎます（最大長: ${filters.maxLen}）`);
      }
      // 2語アナグラムの場合（最大単語長は maxLen を利用）
      if ($("#twoWordMode").checked && letters.length > filters.maxLen * 2) {
        throw new Error(`入力が長すぎます（2語時の最大合計長: ${filters.maxLen * 2}）`);
      }

      const single = anagramsOneWord(letters, filters);
      let pairs = [];
      if ($("#twoWordMode").checked) {
        const bw = Math.max(1, parseInt($("#beamWidth").value, 10) || 200);
        const topN = Math.max(1, parseInt($("#topN").value, 10) || 200);
        pairs = anagramsTwoWords(letters, filters, bw, topN);
      }
      showResults(single, pairs);
      $("#status").textContent = "完了";
    } catch (e) {
      $("#status").textContent = `エラー: ${e.message}`;
    }
  }, 0);
});


  $("#exportCsvBtn").addEventListener("click", exportCSV);
  $("#exportJsonBtn").addEventListener("click", exportJSON);

  // Wordlist via file
  $("#loadWordlistBtn").addEventListener("click", async () => {
    const fi = $("#wordlistFile");
    if (!fi.files || fi.files.length === 0) {
      $("#status").textContent = "辞書ファイルを選択してください";
      return;
    }
    try {
      const text = await fi.files[0].text();
      loadWordlistFromText(text);
      $("#status").textContent = "辞書読み込みOK";
    } catch (e) {
      $("#status").textContent = `辞書読み込み失敗: ${e.message}`;
    }
  });

  // Wordlist via fetch (relative path on Pages)
  $("#fetchWordlistBtn").addEventListener("click", async () => {
    const path = $("#wordlistPath").value.trim();
    if (!path) {
      $("#status").textContent = "相対パスを入力してください";
      return;
    }
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      loadWordlistFromText(text);
      $("#status").textContent = "辞書fetch OK";
    } catch (e) {
      $("#status").textContent = `fetch失敗: ${e.message}`;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  $("#dictStatus").textContent = DICT_LOADED_DESC;
  bindEvents();
});
