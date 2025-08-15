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
let DICT_SOURCES = [];         // Array of {name: string, words: string[], enabled: boolean}
let BUILTIN_ENABLED = true;   // Built-in dictionary enabled state

// Tiny built-in demo words (very small)
const MINI_WORDS = [
  "LISTEN","SILENT","ENLIST","INLETS",
  "STONE","NOTES","TONES",
  "APPLE","PEAL","PALE","LEAP","PEAL","PLEA",
  "TEAM","MEAT","MATE","TAME",
  "RATE","TEAR","TARE"
];

function rebuildDictStructures() {
  WORDS = [];
  SIG2WORDS.clear();
  WORD_FREQ.clear();

  const seen = new Set();
  
  // Include built-in dictionary if enabled
  if (BUILTIN_ENABLED) {
    for (const raw of MINI_WORDS) {
      const w = sanitizeLetters(raw);
      if (!w) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      WORDS.push(w);
    }
  }
  
  // Add words from enabled dictionaries only
  for (const dict of DICT_SOURCES) {
    if (!dict.enabled) continue;
    for (const raw of dict.words) {
      const w = sanitizeLetters(raw);
      if (!w) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      WORDS.push(w);
    }
  }

  // Build signature and frequency maps
  for (const w of WORDS) {
    const sig = toSignature(w);
    if (!SIG2WORDS.has(sig)) SIG2WORDS.set(sig, []);
    SIG2WORDS.get(sig).push(w);
    WORD_FREQ.set(w, freqVecFromString(w));
  }
}

function updateDictionaryStats() {
  $("#wordCount").textContent = WORDS.length.toLocaleString();
  $("#signatureCount").textContent = SIG2WORDS.size.toLocaleString();
}

function updateDictionaryDisplay() {
  // Create display text for enabled dictionaries only
  const enabledDictNames = [];
  if (BUILTIN_ENABLED) {
    enabledDictNames.push("内蔵ミニ辞書");
  }
  enabledDictNames.push(...DICT_SOURCES.filter(d => d.enabled).map(d => d.name));
  const displayText = enabledDictNames.length > 0 ? enabledDictNames.join(", ") : "辞書未選択";
  
  // Update all dictionary name displays
  const dictDisplays = $$(".dict-name");
  dictDisplays.forEach(el => {
    el.textContent = displayText;
  });
  
  const currentDictInfo = $("#currentDictInfo");
  if (currentDictInfo) {
    currentDictInfo.textContent = displayText;
  }
  
  // Update dictionary list in settings (only if DOM is ready)
  if (document.readyState === 'loading') {
    console.log("DOM not ready, skipping dictionary list update");
  } else {
    updateDictionaryList();
  }
}

function updateDictionaryList() {
  const listContainer = $("#dictListContainer");
  if (!listContainer) {
    console.log("dictListContainer not found, skipping update");
    return;
  }
  
  listContainer.innerHTML = "";
  
  // Built-in dictionary (always present)
  const builtInItem = document.createElement("div");
  builtInItem.className = "dict-item";
  builtInItem.innerHTML = `
    <label class="dict-checkbox">
      <input type="checkbox" ${BUILTIN_ENABLED ? 'checked' : ''} onchange="toggleBuiltinDictionary(this.checked)">
      <span class="dict-item-name">内蔵ミニ辞書</span>
    </label>
    <span class="dict-item-count">${MINI_WORDS.length} 語</span>
    <span class="dict-item-status">標準</span>
  `;
  listContainer.appendChild(builtInItem);
  
  // Loaded dictionaries
  DICT_SOURCES.forEach((dict, index) => {
    const item = document.createElement("div");
    item.className = "dict-item";
    item.innerHTML = `
      <label class="dict-checkbox">
        <input type="checkbox" ${dict.enabled ? 'checked' : ''} onchange="toggleDictionary(${index}, this.checked)">
        <span class="dict-item-name">${dict.name}</span>
      </label>
      <span class="dict-item-count">${dict.words.length} 語</span>
      <button class="btn btn-ghost btn-small" onclick="removeDictionary(${index})">削除</button>
    `;
    listContainer.appendChild(item);
  });
}

function addDictionary(text, sourceName = "カスタム辞書") {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  
  // Check if dictionary with same name already exists
  const existingIndex = DICT_SOURCES.findIndex(d => d.name === sourceName);
  if (existingIndex !== -1) {
    // Replace existing dictionary but keep enabled state
    DICT_SOURCES[existingIndex] = { 
      name: sourceName, 
      words: lines, 
      enabled: DICT_SOURCES[existingIndex].enabled 
    };
  } else {
    // Add new dictionary (enabled by default)
    DICT_SOURCES.push({ name: sourceName, words: lines, enabled: true });
  }
  
  rebuildDictStructures();
  updateDictionaryStats();
  updateDictionaryDisplay();
  
  const totalWords = WORDS.length;
  $("#dictStatus").textContent = `辞書：合計 ${totalWords.toLocaleString()} 語を読み込み`;
}

window.toggleBuiltinDictionary = function(enabled) {
  BUILTIN_ENABLED = enabled;
  rebuildDictStructures();
  updateDictionaryStats();
  updateDictionaryDisplay();
  
  const totalWords = WORDS.length;
  $("#dictStatus").textContent = `辞書：合計 ${totalWords.toLocaleString()} 語を使用中`;
}

window.toggleDictionary = function(index, enabled) {
  if (index >= 0 && index < DICT_SOURCES.length) {
    DICT_SOURCES[index].enabled = enabled;
    rebuildDictStructures();
    updateDictionaryStats();
    updateDictionaryDisplay();
    
    const totalWords = WORDS.length;
    $("#dictStatus").textContent = `辞書：合計 ${totalWords.toLocaleString()} 語を使用中`;
  }
}

window.removeDictionary = function(index) {
  if (index >= 0 && index < DICT_SOURCES.length) {
    DICT_SOURCES.splice(index, 1);
    rebuildDictStructures();
    updateDictionaryStats();
    updateDictionaryDisplay();
    
    const totalWords = WORDS.length;
    $("#dictStatus").textContent = `辞書：合計 ${totalWords.toLocaleString()} 語を読み込み`;
  }
}

// Initialize with built-in dictionary (will be called after DOM loads)

// ===== Filters =====
function buildFilters() {
  const minLen = Math.max(1, parseInt($("#minLen").value, 10) || 1);
  const maxLen = Math.max(minLen, parseInt($("#maxLen").value, 10) || 99);
  const sw = sanitizeLetters($("#startsWith").value);
  const ew = sanitizeLetters($("#endsWith").value);
  const contains = sanitizeLetters($("#contains").value);

  return {
    minLen, maxLen, sw, ew, contains
  };
}

function buildFiltersTwoWord() {
  const minLen = Math.max(1, parseInt($("#minLenTwoWord").value, 10) || 1);
  const maxLen = Math.max(minLen, parseInt($("#maxLenTwoWord").value, 10) || 99);
  const sw = sanitizeLetters($("#startsWithTwoWord").value);
  const ew = sanitizeLetters($("#endsWithTwoWord").value);
  const contains = sanitizeLetters($("#containsTwoWord").value);

  return {
    minLen, maxLen, sw, ew, contains
  };
}

function passFilters(word, f) {
  if (word.length < f.minLen || word.length > f.maxLen) return false;

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

// Store full results for filtering
let FULL_SINGLE_RESULTS = [];
let FULL_TWO_WORD_RESULTS = [];

// ===== Results table & export =====
function showSingleResults(results) {
  FULL_SINGLE_RESULTS = results;
  updateSingleResultsDisplay();
}

function updateSingleResultsDisplay() {
  const tbody = $("#resultTableSingle tbody");
  tbody.innerHTML = "";
  
  const showPartial = $("#showPartialSingle").checked;
  const filteredResults = showPartial ? 
    FULL_SINGLE_RESULTS : 
    FULL_SINGLE_RESULTS.filter(r => r.kind === "1語(完全変位)");
  
  let rank = 1;
  for (const r of filteredResults) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rank++}</td>
      <td><code>${r.word}</code></td>
      <td>${r.kind}</td>
      <td>${r.word.length}</td>
      <td><a href="https://eow.alc.co.jp/search?q=${r.word}" target="_blank" class="dict-link" title="英辞郎で意味を調べる">🔍</a></td>
    `;
    tbody.appendChild(tr);
  }

  const totalCount = FULL_SINGLE_RESULTS.length;
  const shownCount = filteredResults.length;
  const hiddenCount = totalCount - shownCount;
  
  let infoText = `${shownCount} 件表示`;
  if (hiddenCount > 0) {
    infoText += ` (${hiddenCount} 件の部分一致を非表示)`;
  }
  $("#resultInfoSingle").textContent = infoText;
}

function showTwoWordResults(results) {
  FULL_TWO_WORD_RESULTS = results;
  updateTwoWordResultsDisplay();
}

function updateTwoWordResultsDisplay() {
  const tbody = $("#resultTableTwoWord tbody");
  tbody.innerHTML = "";
  
  const showPartial = $("#showPartialTwoWord").checked;
  // For two-word results, we only have complete anagrams, so no filtering needed for now
  // But keeping the structure for consistency
  const filteredResults = FULL_TWO_WORD_RESULTS;
  
  let rank = 1;
  for (const r of filteredResults) {
    const display = r.pair.join(" ");
    const searchQuery = r.pair.join("%20");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rank++}</td>
      <td><code>${display}</code></td>
      <td>${r.kind}</td>
      <td>${r.len}</td>
      <td><a href="https://eow.alc.co.jp/search?q=${searchQuery}" target="_blank" class="dict-link" title="英辞郎で意味を調べる">🔍</a></td>
    `;
    tbody.appendChild(tr);
  }

  $("#resultInfoTwoWord").textContent = `${filteredResults.length} 件表示`;
}

function exportCSV(tableId, filename) {
  const rows = [];
  $$(tableId + " tbody tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    rows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText, tds[3].innerText]);
  });
  const header = "rank,candidate,type,length\n";
  const body = rows.map(r => r.map(x => `"${x.replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(tableId, filename) {
  const data = [];
  $$(tableId + " tbody tr").forEach(tr => {
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
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ===== Tab switching =====
function initTabSwitching() {
  const tabBtns = $$(".tab-btn");
  const tabContents = $$(".tab-content");
  
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      
      // Update active states
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      const content = document.querySelector(`.tab-content[data-tab="${tabName}"]`);
      if (content) content.classList.add("active");
    });
  });
}

// ===== Events =====
function bindEvents() {
  // Single word tab events
  $("#normalizeBtn").addEventListener("click", () => {
    const s = sanitizeLetters($("#letters").value);
    $("#letters").value = s;
  });

  $("#clearBtn").addEventListener("click", () => {
    $("#letters").value = "";
    $("#statusSingle").textContent = "";
    $("#resultInfoSingle").textContent = "";
    $("#resultTableSingle tbody").innerHTML = "";
  });

  $("#runSingleBtn").addEventListener("click", () => {
    $("#statusSingle").textContent = "探索中...";
    setTimeout(() => {
      try {
        const letters = sanitizeLetters($("#letters").value);
        if (!letters) throw new Error("文字列を入力してください（A–Z）");

        const filters = buildFilters();

        // 長すぎチェック
        if (letters.length > filters.maxLen) {
          throw new Error(`入力が長すぎます（最大長: ${filters.maxLen}）`);
        }

        const results = anagramsOneWord(letters, filters);
        showSingleResults(results);
        $("#statusSingle").textContent = "完了";
      } catch (e) {
        $("#statusSingle").textContent = `エラー: ${e.message}`;
      }
    }, 0);
  });

  $("#exportCsvSingleBtn").addEventListener("click", () => {
    exportCSV("#resultTableSingle", "single_anagram_results.csv");
  });
  $("#exportJsonSingleBtn").addEventListener("click", () => {
    exportJSON("#resultTableSingle", "single_anagram_results.json");
  });

  // Partial match filter for single word results
  $("#showPartialSingle").addEventListener("change", () => {
    updateSingleResultsDisplay();
  });

  // Two word tab events
  $("#normalizeTwoWordBtn").addEventListener("click", () => {
    const s = sanitizeLetters($("#lettersTwoWord").value);
    $("#lettersTwoWord").value = s;
  });

  $("#clearTwoWordBtn").addEventListener("click", () => {
    $("#lettersTwoWord").value = "";
    $("#statusTwoWord").textContent = "";
    $("#resultInfoTwoWord").textContent = "";
    $("#resultTableTwoWord tbody").innerHTML = "";
  });

  $("#runTwoWordBtn").addEventListener("click", () => {
    $("#statusTwoWord").textContent = "探索中...";
    setTimeout(() => {
      try {
        const letters = sanitizeLetters($("#lettersTwoWord").value);
        if (!letters) throw new Error("文字列を入力してください（A–Z）");

        const filters = buildFiltersTwoWord();

        // 長すぎチェック（2語時の最大合計長）
        if (letters.length > filters.maxLen * 2) {
          throw new Error(`入力が長すぎます（2語時の最大合計長: ${filters.maxLen * 2}）`);
        }

        const bw = Math.max(1, parseInt($("#beamWidth").value, 10) || 200);
        const topN = Math.max(1, parseInt($("#topN").value, 10) || 200);
        const results = anagramsTwoWords(letters, filters, bw, topN);
        showTwoWordResults(results);
        $("#statusTwoWord").textContent = "完了";
      } catch (e) {
        $("#statusTwoWord").textContent = `エラー: ${e.message}`;
      }
    }, 0);
  });

  $("#exportCsvTwoWordBtn").addEventListener("click", () => {
    exportCSV("#resultTableTwoWord", "two_word_anagram_results.csv");
  });
  $("#exportJsonTwoWordBtn").addEventListener("click", () => {
    exportJSON("#resultTableTwoWord", "two_word_anagram_results.json");
  });

  // Partial match filter for two word results
  $("#showPartialTwoWord").addEventListener("change", () => {
    updateTwoWordResultsDisplay();
  });

  // Wordlist via file
  $("#loadWordlistBtn").addEventListener("click", async () => {
    const fi = $("#wordlistFile");
    if (!fi.files || fi.files.length === 0) {
      $("#dictStatus").textContent = "辞書ファイルを選択してください";
      return;
    }
    try {
      const text = await fi.files[0].text();
      const filename = fi.files[0].name;
      addDictionary(text, filename);
      $("#dictStatus").textContent = "辞書読み込みOK";
      fi.value = ""; // Clear file input for next selection
    } catch (e) {
      $("#dictStatus").textContent = `辞書読み込み失敗: ${e.message}`;
    }
  });

  // Wordlist via fetch (relative path on Pages)
  $("#fetchWordlistBtn").addEventListener("click", async () => {
    const path = $("#wordlistPath").value.trim();
    if (!path) {
      $("#dictStatus").textContent = "相対パスを入力してください";
      return;
    }
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const filename = path.split('/').pop();
      addDictionary(text, filename);
      $("#dictStatus").textContent = "辞書fetch OK";
      $("#wordlistPath").value = ""; // Clear input for next fetch
    } catch (e) {
      $("#dictStatus").textContent = `fetch失敗: ${e.message}`;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize dictionary first
  rebuildDictStructures();
  
  $("#dictStatus").textContent = "辞書：内蔵ミニ辞書（18語）";
  updateDictionaryStats();
  updateDictionaryDisplay();
  initTabSwitching();
  bindEvents();
});
