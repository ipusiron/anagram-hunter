# Anagram Hunter - 高速アナグラム探索ツール

![GitHub Repo stars](https://img.shields.io/github/stars/ipusiron/anagram-hunter?style=social)
![GitHub forks](https://img.shields.io/github/forks/ipusiron/anagram-hunter?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/ipusiron/anagram-hunter)
![GitHub license](https://img.shields.io/github/license/ipusiron/anagram-hunter)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://ipusiron.github.io/anagram-hunter/)

**Day045 - 生成AIで作るセキュリティツール100**

アナグラム（並べ替え語）を**辞書照合＋署名インデックス**で高速に抽出するツール。  

---

## 🔗 デモページ

👉 [https://ipusiron.github.io/anagram-hunter/](https://ipusiron.github.io/anagram-hunter/)

---

## 📸 スクリーンショット

>![ダミー](assets/screenshot.png)
>
>*ダミー*

---

## 主な機能
- **単語アナグラム**：入力文字列（A–Z）から辞書一致する全アナグラムを列挙
- **2語アナグラム**（限定探索）：`BEAM幅`と`最大候補数`で枝刈りしつつ2語分割を探索
- **フィルター**：最小/最大長、必須文字、除外文字、先頭/末尾/部分一致パターン
- **辞書読み込み**：ローカルTXT（1行=1単語） or Pages相対パス `fetch`
- **エクスポート**：結果をCSV/JSONで保存
- **速度最適化**：署名（ソート文字列）→語リスト、26次元ベクトルで上限チェック

1つ目のタブが単語アナグラム、
2つ目のタブが2語アナグラム、
3つ目のタブがパスフレーズアナグラム（未実装）
とする。

---

## 使い方
1. 文字列（例：`LISTEN`）を入力し、必要なフィルターを設定  
2. 辞書を読み込む（英単語5k/10kなどを推奨）  
3. 「探索」を押す → 結果一覧にアナグラム候補が表示されます  
4. 2語アナグラムを試す場合は、スイッチONで探索（注：辞書サイズと文字数に依存）

---

## 入力と正規化
- 入力は **A–Z のみ**使用（他は削除し大文字化）
- 辞書側もA–Zのみで正規化して登録（重複は自動除去）

---

## 2語アナグラム探索の考え方（簡易）
- まず単語候補集合を **文字包含チェック**で事前絞り込み  
- 1語目を選んだら残差ベクトルを計算し、残差を満たす2語目候補を照合  
- ビーム幅・上位Nで探索空間を制御（教育用MVP）

---

## ディレクトリー構成

```
/ (repo root)
├─ index.html
├─ style.css
├─ script.js
└─ wordlists/
　　　└─ english-words-5k.txt
```

---
## 今後の拡張（Day046と共通利用）
- 頻度付き辞書（例：`word,prior`）の導入 → スコアリング拡張  
- Trie（前置詞集合）による**前方一致フィルター**（Cipher Clairvoyanceで本格利用）
- 多語（3語以上）分割の段階的ビーム探索

---

## 技術説明

辞書・正規化ロジック・前置詞集合は、別ツールと共通化しやすい設計です。

---

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) をご覧ください。

---

## 🛠 このツールについて

本ツールは、「生成AIで作るセキュリティツール100」プロジェクトの一環として開発されました。  
このプロジェクトでは、AIの支援を活用しながら、セキュリティに関連するさまざまなツールを100日間にわたり制作・公開していく取り組みを行っています。

プロジェクトの詳細や他のツールについては、以下のページをご覧ください。

🔗 [https://akademeia.info/?page_id=42163](https://akademeia.info/?page_id=42163)
