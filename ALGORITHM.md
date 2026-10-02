# アナグラム探索アルゴリズム詳細解説

このドキュメントでは、Anagram Hunterで実装されているアナグラム探索アルゴリズムについて詳細に解説します。コードはすべて`js/anagram-core.js`にあり、`test/core.test.js`と`test/wordlists.test.js`が動作を検証しています。

## 目次

1. [基本概念](#基本概念)
2. [データ構造](#データ構造)
3. [正規化](#正規化)
4. [単語アナグラム探索](#単語アナグラム探索)
5. [2語アナグラム探索](#2語アナグラム探索)
6. [計算量分析](#計算量分析)
7. [実装上の注意点](#実装上の注意点)
8. [今後の改善案](#今後の改善案)

---

## 基本概念

### アナグラムとは
アナグラム（Anagram）とは、ある文字列の文字を並び替えて別の意味のある単語や文を作ることです。

**例:**
- `LISTEN` → `SILENT`, `ENLIST`, `INLETS`
- `DORMITORY` → `DIRTY ROOM`

### 探索の種類
1. **全文字を使う語**: 入力文字をすべて使用（例：LISTEN → SILENT）
2. **一部の文字を使う語**: 入力文字の一部のみ使用（例：LISTEN → NEST、残りの文字はIL）
3. **2語アナグラム**: 入力文字をちょうど使い切る2つの単語の組み合わせ（例：FIREWALL → FIRE + WALL）

---

## データ構造

### 1. 署名（Signature）
文字列の文字をアルファベット順にソートした文字列。同じ署名を持つ単語は互いにアナグラムの関係にある。

```javascript
export function signature(word) {
  return word.split('').sort().join('');
}

// 例
signature('LISTEN'); // → 'EILNST'
signature('SILENT'); // → 'EILNST'
signature('ENLIST'); // → 'EILNST'
```

### 2. 頻度ベクトル
各文字（A-Z）の出現回数を26次元ベクトル（`Uint8Array`）で表現。文字の包含関係を効率的にチェック可能。

```javascript
export function freqVector(word) {
  const v = new Uint8Array(26);
  for (let i = 0; i < word.length; i++) {
    const k = word.charCodeAt(i) - 65; // A=0, B=1, ..., Z=25
    if (k >= 0 && k < 26) v[k] += 1;
  }
  return v;
}

// 例: LISTEN
// A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
// 0 0 0 0 1 0 0 0 1 0 0 1 0 1 0 0 0 0 1 1 0 0 0 0 0 0
```

頻度ベクトルは署名と同じ情報を持っており、`vectorToSignature`で署名に戻せます（各文字をその個数だけABC順に並べる）。

### 3. 索引

```javascript
// buildIndex(wordLists) が返すもの
{
  words,        // 正規化して重複を除いた全単語（複数の辞書をまとめたもの）
  bySignature,  // Map: 署名 → 単語の配列
  freq          // Map: 単語 → 頻度ベクトル
}
```

---

## 正規化

入力も辞書の各行も、同じ`normalizeLetters`でA〜Zの大文字にそろえます。

1. NFKCで全角英字を半角にする（`ＬＩＳＴＥＮ` → `LISTEN`）
2. NFDでアクセント記号を分けて外す（`café` → `CAFE`）
3. 大文字にして英字だけを残す。空白は区切りとして数えず、それ以外の英字でない文字（数字・記号・かな）は「無視した文字」として数える

辞書は1行に1語として読み、英字だけに直したあとで重複を除きます（`a-dream`と`adream`は同じ`ADREAM`になります）。

---

## 単語アナグラム探索

辞書の各語について、入力の文字で作れるか（頻度ベクトルの各成分が入力以下か）を確かめます。作れる語のうち、残りの文字がない語が「全文字を使う語」、残りがある語が「一部の文字を使う語」です。

```javascript
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
  // 全文字を使う語が先、次に長い語、同じ長さはABC順
  ...
}
```

### 包含チェック関数

```javascript
export function canCover(need, have) {
  for (let i = 0; i < 26; i++) if (need[i] > have[i]) return false;
  return true;
}
```

**例**: `LISTEN`で`NEST`が作れるか？
- LISTEN: E1 I1 L1 N1 S1 T1
- NEST: E1 N1 S1 T1
- 判定: NEST ≤ LISTEN → **True**（作れる）。残りの文字は`IL`

最大の長さ・最小の長さは、見つかる語の長さにだけ掛かります。入力の長さは制限しません（画面では入力の英字を100字までにしています）。

---

## 2語アナグラム探索

### アルゴリズム概要

2語の組（w1, w2）で入力の文字をちょうど使い切るとき、w1を決めると、w2の文字は「入力からw1を引いた残り」に決まります。つまりw2の署名は残りの文字の署名そのものです。署名の索引を1回引けば、w2の候補がすべて手に入ります。

1. 辞書の各語w1について、入力より短く、入力の文字で作れるかを確かめる（1語目の候補）
2. 残りの文字の頻度ベクトルを署名に戻す
3. 索引でその署名の語をすべて取り出し、それぞれをw2とする
4. 組はABC順の2語で1回だけ数える（w1とw2を入れ替えた組は同じ組）

辞書を1回なめるだけで、取りこぼしのない全探索になります。

```javascript
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
  // 短いほうの語が長い組を先に（3字＋5字より4字＋4字）、次にABC順
  ...
}
```

### 探索例

`FIREWALL` → `FIRE` + `WALL`を見つける過程：

1. **入力**: `FIREWALL`の署名は`AEFILLRW`
2. **1語目**: `FIRE`（署名`EFIR`）はFIREWALLの文字で作れる
3. **残り**: `AEFILLRW`から`EFIR`を引くと`ALLW`
4. **2語目**: 索引で署名`ALLW`を引くと`WALL`が見つかる
5. **結果**: `FIRE WALL`

付属辞書を最初から使う状態（3,233語）では、FIREWALLの1語目の候補は33語で、FAIR WELL・FALL WIRE・FEAR WILL・FILL WEAR・FIRE WALL・LAW RIFLEの6組が見つかります。

### 同じ語を2回使う組
`TEAMTEAM`のように、同じ語を2回使うと入力をちょうど使い切る場合は、その組（`MATE MATE`など）も結果に含めます。

---

## 計算量分析

Nを辞書の語数、Lを入力の長さとします。

### 単語アナグラム探索
- 各語について26文字の比較と、残りの文字の署名づくり: O(N × 26)
- 結果の並べ替え: O(K log K)（Kは見つかった語の数）

### 2語アナグラム探索
- 1語目の候補の絞り込み: O(N × 26)
- 候補ごとに署名を1回引く: O(C × 26)（Cは1語目の候補の数）
- 全体: O(N × 26 ＋ 結果の数)

どちらも辞書を1回なめるだけで、入力の長さにはほとんど左右されません。付属辞書を最初から使う状態では、2語の探索は1ミリ秒未満で終わります（Node.js 22での実測で0.2〜0.7ms）。

**総当たりとの比較**: すべての語の組を調べるとO(N²)になり、3,233語では約1千万組です。`test/core.test.js`では、小さな辞書で署名の引き当てと総当たりが同じ組を返すことを確かめています。

---

## 実装上の注意点

### 1. 正規化
入力と辞書を同じ関数でA-Zの大文字にそろえます。正規化の仕方が違うと、同じ語が別の語として扱われます。

### 2. 重複除去
1つの辞書の中の重複（付属辞書english_5067.txtは5,068行のうち2,123行が重複）と、複数の辞書のあいだの重複は、索引を作るときに1つにまとめます。

### 3. フィルター適用
長さ・先頭・末尾・含む文字列の条件は、2語の探索では両方の語に掛けます。

### 4. 表示と書き出し
画面には上限（既定200件）までを出し、CSV・JSONには全件を書き出します。辞書名や結果は`textContent`で画面に入れ、HTMLとして解釈させません。

---

## 今後の改善案

### 1. 3語以上の組
2語の探索を再帰的に広げます。語数の上限と、探索の手数の上限が必要です。

### 2. 単語の使われやすさによる並べ替え
出典の確かな頻度表があれば、よく使われる語を含む組を先に出せます。

### 3. 位置の決まった文字
クロスワードのように「2文字目がA」などの条件で絞り込みます。

---

## 参考文献・関連アルゴリズム

1. **文字列アルゴリズム**: ソートによる正規形（署名）、ハッシュ表による索引
2. **組み合わせ探索**: 部分和問題、バックトラッキング
3. **暗号解読**: 転置式暗号の多重アナグラム法（Russell, Clark, Stepney: Making the Most of Two Heuristics: Breaking Transposition Ciphers with Ants, CEC 2003）

このアルゴリズムは教育目的で設計されており、実装の理解と改良を通じて文字列処理・探索アルゴリズムの学習に活用できます。
