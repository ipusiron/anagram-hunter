# アナグラム探索アルゴリズム詳細解説

このドキュメントでは、Anagram Hunterで実装されているアナグラム探索アルゴリズムについて詳細に解説します。コードはすべて`js/anagram-core.js`にあり、`test/core.test.js`と`test/wordlists.test.js`が動作を検証しています。

## 目次

1. [基本概念](#基本概念)
2. [データ構造](#データ構造)
3. [正規化](#正規化)
4. [単語アナグラム探索](#単語アナグラム探索)
5. [2語アナグラム探索](#2語アナグラム探索)
6. [フレーズ（3語以上）の探索](#フレーズ3語以上の探索)
7. [組み立てと比較](#組み立てと比較)
8. [計算量分析](#計算量分析)
9. [実装上の注意点](#実装上の注意点)
10. [今後の改善案](#今後の改善案)

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
4. **フレーズ**: 入力文字をちょうど使い切る3語以上の組み合わせ（例：ELEVENPLUSTWO → TWELVE + PLUS + ONE）

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

## フレーズ（3語以上）の探索

`findPhrases`は、入力の文字をちょうど使い切る、語数の上限（5語まで）以下の組をすべて探します。

1. **候補の絞り込み**: 入力の文字で作れて、絞り込みの条件に合う語を候補にし、長い順（同じ長さはABC順）に並べる
2. **語の順だけが違う組を出さない**: 前に選んだ語より後ろ（同じ語の繰り返しを許すときは同じ位置から）の候補だけを選ぶ。TWELVE PLUS ONEとONE PLUS TWELVEは同じ組なので、1回しか出ない
3. **最後の1語は署名で引く**: 各段で、残りの文字の署名に当たる語が候補の後ろにあれば、そこで1組が完成する（2語の探索と同じ考え方）
4. **候補を段ごとに絞る**: ある語を選んだら、その語を除いた残りの文字でも作れる候補だけを次の段へ渡す。深い段ほど候補が減る
5. **長さの枝刈り**: 残りを2語以上に分けるときは、各語の最小の長さの2倍に満たない残りでは先へ進まない

```javascript
// 次の段へ渡す候補（cands は pool の位置、昇順）
for (let m = from; m < cands.length; m++) {
  const j = cands[m];
  if (pool[j].length <= rest && canCover(vec[j], next)) sub.push(j);
}
```

必ず含める語は、探索の前に入力の文字から引いておきます（作れなければその場で知らせます）。使わない語は候補から外します。

組の数は辞書と入力によって急に増えるので、次のどれかに達したら打ち切り、そのことを画面に出します。

- 組の数が5,000
- 探索の手数（再帰の呼び出しの数）が200万
- 時間が3秒（画面からの呼び出し）

長い語から順に探すので、打ち切ったときに出ていない可能性があるのは、短い語の多い組です。

付属辞書を最初から使う状態で、ELEVENPLUSTWOを3語まで・各3字以上・同じ語の繰り返しなしで探すと、候補は78語、手数は713で、TWELVE PLUS ONEを含む9組が見つかります。

---

## 組み立てと比較

### 組み立て
画面の「組み立て」タブは、探索を人が1段ずつ進める形です。入力の文字（署名の形）から、選んだ語の文字を`removeWord`で順に引いていきます。候補は、残りの文字に対する`findSingle`の結果で、次の順に並べます。

1. 残りの文字をちょうど使い切る語（選べば完成）
2. 選んだあとの残りの文字が、辞書のどれかの語の署名と一致する語（あと1語で完成）
3. 長い語

### 比較
`compareLetters`は、2つの文字列の頻度ベクトルを引き算します。差がすべて0ならアナグラムどうしです。片方だけが多い文字を数え、片方の頻度ベクトルがもう片方以下なら「その文字だけで作れる」とします。辞書は使いません。

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

### フレーズの探索
- 組の数そのものが入力と辞書で急に増えるので、上の打ち切り（5,000組・200万手・3秒）で上限を設けている
- 大きい英単語辞書（64,662語）に、同じ文字のない20字（ABCDEFGHIJKLMNOPQRST）を入れる最悪に近い例（各3字以上・同じ語の繰り返しなし）では、3語までで約183万手・約1.9秒、4語までは200万手で打ち切り（約2秒）だった（Node.js 22での実測。組は見つからない）

1語・2語の探索は辞書を1回なめるだけで、入力の長さにはほとんど左右されません。付属辞書を最初から使う状態では、2語の探索は1ミリ秒未満で終わります（Node.js 22での実測で0.2〜0.7ms）。

**総当たりとの比較**: すべての語の組を調べるとO(N²)になり、3,233語では約1千万組です。`test/core.test.js`では、小さな辞書で署名の引き当てと総当たりが同じ組を返すことを確かめています。

---

## 実装上の注意点

### 1. 正規化
入力と辞書を同じ関数でA-Zの大文字にそろえます。正規化の仕方が違うと、同じ語が別の語として扱われます。

### 2. 重複除去
1つの辞書の中の重複（付属辞書english_5067.txtは5,068行のうち2,123行が重複）と、複数の辞書のあいだの重複は、索引を作るときに1つにまとめます。

### 3. フィルター適用
長さ・先頭・末尾・含む文字列・位置の指定の条件は、2語とフレーズの探索ではすべての語に掛けます（画面のフレーズのタブで指定できるのは長さだけ）。

### 4. 表示と書き出し
画面には上限（既定200件）までを出し、CSV・JSONには全件を書き出します。辞書名や結果は`textContent`で画面に入れ、HTMLとして解釈させません。

---

## 今後の改善案

### 1. 単語の使われやすさによる並べ替え
出典の確かな頻度表があれば、よく使われる語を含む組を先に出せます。

### 2. 未知の文字を含む入力
入力の一部の文字が分からないとき（どの文字でもよい1字を含む入力）に、その字を補う語を探します。

---

## 参考文献・関連アルゴリズム

1. **文字列アルゴリズム**: ソートによる正規形（署名）、ハッシュ表による索引
2. **組み合わせ探索**: 部分和問題、バックトラッキング
3. **暗号解読**: 転置式暗号の多重アナグラム法（Russell, Clark, Stepney: Making the Most of Two Heuristics: Breaking Transposition Ciphers with Ants, CEC 2003）

このアルゴリズムは教育目的で設計されており、実装の理解と改良を通じて文字列処理・探索アルゴリズムの学習に活用できます。
