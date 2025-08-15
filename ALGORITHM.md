# アナグラム探索アルゴリズム詳細解説

このドキュメントでは、Anagram Hunterで実装されているアナグラム探索アルゴリズムについて詳細に解説します。

## 目次

1. [基本概念](#基本概念)
2. [データ構造](#データ構造)
3. [単語アナグラム探索](#単語アナグラム探索)
4. [2語アナグラム探索](#2語アナグラム探索)
5. [計算量分析](#計算量分析)
6. [最適化手法](#最適化手法)

---

## 基本概念

### アナグラムとは
アナグラム（Anagram）とは、ある文字列の文字を並び替えて別の意味のある単語や文を作ることです。

**例:**
- `LISTEN` → `SILENT`, `ENLIST`, `INLETS`
- `HEART` → `EARTH`, `HATER`

### 探索の種類
1. **完全変位アナグラム**: 入力文字をすべて使用（例：LISTEN → SILENT）
2. **部分使用アナグラム**: 入力文字の一部のみ使用（例：LISTEN → NEST）
3. **2語アナグラム**: 2つの単語の組み合わせ（例：LISTEN → SIT + LEN）

---

## データ構造

### 1. 署名（Signature）
文字列の文字をアルファベット順にソートした文字列。同じ署名を持つ単語は互いにアナグラムの関係にある。

```javascript
function toSignature(s) {
  return s.split("").sort().join("");
}

// 例
toSignature("LISTEN"); // → "EILNST"
toSignature("SILENT"); // → "EILNST"
toSignature("ENLIST"); // → "EILNST"
```

### 2. 頻度ベクトル
各文字（A-Z）の出現回数を26次元ベクトルで表現。文字の包含関係を効率的にチェック可能。

```javascript
function freqVecFromString(s) {
  const v = new Array(26).fill(0);
  for (const ch of s) {
    const i = ch.charCodeAt(0) - 65; // A=0, B=1, ..., Z=25
    if (i >= 0 && i < 26) v[i]++;
  }
  return v;
}

// 例
freqVecFromString("LISTEN"); // → [0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,0,1,1,0,0,0,0,0,0]
//                                  A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
//                                  0 0 0 0 1 0 0 0 1 0 0 1 0 1 0 0 0 0 1 1 0 0 0 0 0 0
```

### 3. 主要データ構造

```javascript
let WORDS = [];                // 正規化された全単語リスト
let SIG2WORDS = new Map();     // 署名 → 単語配列のマップ
let WORD_FREQ = new Map();     // 単語 → 頻度ベクトルのマップ
```

---

## 単語アナグラム探索

### アルゴリズム概要

1. **完全変位の探索**: 署名マップを使用
2. **部分使用の探索**: 頻度ベクトルで包含チェック

### 実装詳細

```javascript
function anagramsOneWord(letters, filters) {
  const sig = toSignature(letters);
  const have = freqVecFromString(letters);
  
  // 1. 完全変位アナグラム（署名一致）
  const exactList = SIG2WORDS.get(sig) || [];
  const outExact = exactList.filter(w => passFilters(w, filters));
  
  // 2. 部分使用アナグラム（頻度ベクトル包含）
  const outSub = [];
  for (const w of WORDS) {
    const fv = WORD_FREQ.get(w);
    if (!canCover(fv, have)) continue; // 包含チェック
    if (!passFilters(w, filters)) continue;
    outSub.push(w);
  }
  
  // 3. 結果のマージと重複除去
  const set = new Set();
  const res = [];
  
  for (const w of outExact) {
    if (!set.has(w)) { 
      res.push({ kind: "1語(完全変位)", word: w }); 
      set.add(w); 
    }
  }
  
  for (const w of outSub) {
    if (!set.has(w)) { 
      res.push({ kind: "1語(部分使用)", word: w }); 
      set.add(w); 
    }
  }
  
  return res;
}
```

### 包含チェック関数

```javascript
function canCover(need, have) {
  // need <= have (各成分について)
  for (let i = 0; i < 26; i++) {
    if (need[i] > have[i]) return false;
  }
  return true;
}
```

**例**: `LISTEN`で`NEST`が作れるか？
- LISTEN: `[0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,0,1,1,0,0,0,0,0,0]`
- NEST:   `[0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0]`
- 判定: NEST ≤ LISTEN → **True**（作れる）

---

## 2語アナグラム探索

### アルゴリズム概要

2語アナグラムは組み合わせ爆発を起こしやすいため、ビーム探索で計算量を制御。

### 実装手順

1. **候補1語目の絞り込み**: 頻度ベクトルで包含チェック
2. **ビーム選択**: 長い単語優先でビーム幅まで選択
3. **2語目の探索**: 残差ベクトルを使用
4. **完全変位チェック**: 残差がゼロベクトルになるかチェック

### 実装詳細

```javascript
function anagramsTwoWords(letters, filters, beamWidth = 200, topN = 200) {
  const have = freqVecFromString(letters);
  
  // Step 1: 1語目候補の絞り込み
  const cand1 = [];
  for (const w of WORDS) {
    const fv = WORD_FREQ.get(w);
    if (!canCover(fv, have)) continue;        // 包含チェック
    if (!passFilters(w, filters)) continue;   // フィルターチェック
    cand1.push(w);
  }
  
  // Step 2: ビーム選択（長い単語優先）
  cand1.sort((a,b) => b.length - a.length || a.localeCompare(b));
  const beams = cand1.slice(0, beamWidth);
  
  // Step 3: 各ビームについて2語目を探索
  const results = [];
  
  outer: for (const w1 of beams) {
    const rem = subVec(have, WORD_FREQ.get(w1)); // 残差計算
    
    for (const w2 of WORDS) {
      const fv2 = WORD_FREQ.get(w2);
      if (!canCover(fv2, rem)) continue;        // 残差包含チェック
      if (!passFilters(w2, filters)) continue;
      
      const rem2 = subVec(rem, fv2);            // 最終残差
      if (!isZeroVec(rem2)) continue;           // 完全変位チェック
      
      // 発見！
      const pair = [w1, w2].sort(); // 正規化
      results.push({ 
        kind: "2語(完全変位)", 
        pair, 
        len: pair[0].length + pair[1].length 
      });
      
      if (results.length >= topN) break outer;  // 上限チェック
    }
  }
  
  return results;
}
```

### ベクトル演算

```javascript
// ベクトル減算
function subVec(a, b) {
  const out = new Array(26);
  for (let i = 0; i < 26; i++) out[i] = a[i] - b[i];
  return out;
}

// ゼロベクトル判定
function isZeroVec(v) {
  for (let i = 0; i < 26; i++) if (v[i] !== 0) return false;
  return true;
}
```

### 探索例

`LISTEN` → `LIT` + `SEN` を見つける過程：

1. **初期状態**: `LISTEN` = `[0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,0,1,1,0,0,0,0,0,0]`

2. **1語目選択**: `LIT` = `[0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0]`

3. **残差計算**: 
   ```
   LISTEN - LIT = [0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0]
   ```

4. **2語目探索**: `SEN` = `[0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0]`

5. **最終残差**: 
   ```
   残差 - SEN = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] ✓
   ```

6. **結果**: `LIT SEN` が2語アナグラムとして発見

---

## 計算量分析

### 単語アナグラム探索

- **完全変位**: O(1) - 署名による直接検索
- **部分使用**: O(N) - N: 辞書サイズ
- **全体**: O(N)

### 2語アナグラム探索

- **候補絞り込み**: O(N)
- **ビーム選択**: O(N log N) - ソート
- **2語目探索**: O(B × N) - B: ビーム幅
- **全体**: O(B × N)

**ビーム幅の効果**:
- B = 200, N = 5000の場合: 最大100万回の比較
- ビーム幅を制限することで実用的な速度を実現

---

## 最適化手法

### 1. 署名インデックス
同じ署名を持つ単語を事前にグループ化することで、完全変位アナグラムをO(1)で検索。

### 2. 頻度ベクトルキャッシュ
各単語の頻度ベクトルを事前計算してキャッシュ。包含チェックを高速化。

### 3. ビーム探索
2語アナグラムの組み合わせ爆発を制御。長い単語を優先することで有用な結果を効率的に発見。

### 4. 早期終了
- 上位N件に達したら探索終了
- 残差チェックで不可能な組み合わせを早期除外

### 5. メモリ効率
- 26次元の小さなベクトルで文字情報を表現
- Map構造による効率的な検索

---

## 実装上の注意点

### 1. 正規化
全ての入力をA-Zの大文字に正規化。一貫性を保つことで検索の確実性を向上。

### 2. 重複除去
署名検索と頻度ベクトル検索の結果をマージする際、Setを使用して重複を除去。

### 3. フィルター適用
長さ・パターンマッチなどのフィルターを適切なタイミングで適用し、無駄な計算を削減。

### 4. エラーハンドリング
辞書が空の場合や、入力が無効な場合の適切な処理。

---

## 今後の改善案

### 1. Trie構造の導入
前置辞フィルターの高速化。特に長い単語リストでの性能向上が期待される。

### 2. 並列処理
Web Workerを使用した並列探索。大規模辞書での応答性向上。

### 3. 増分探索
文字追加時の差分計算による高速化。

### 4. 統計的最適化
- 頻度の高い文字パターンの優先探索
- 単語の使用頻度に基づく結果ランキング

---

## 参考文献・関連アルゴリズム

1. **文字列アルゴリズム**: Suffix Arrays, Suffix Trees
2. **組み合わせ最適化**: Branch and Bound, Beam Search
3. **ハッシュ技法**: Rolling Hash, Perfect Hashing
4. **情報検索**: Inverted Index, N-gram Analysis

このアルゴリズムは教育目的で設計されており、実装の理解と改良を通じて文字列処理・探索アルゴリズムの学習に活用できます。