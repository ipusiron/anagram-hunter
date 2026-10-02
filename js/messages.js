// 画面に出す文言。ロジックはキーと値だけを返し、ここで文にする
// {name} の形の置き場所に値を入れる。言語は setLanguage() で切り替える。t() は今の言語の辞書を引き、なければ日本語を使う

const JA = {
  // 辞書
  'dict.builtin': '内蔵ミニ辞書',
  'dict.bundled.english_5067': '一般英単語（english_5067）',
  'dict.bundled.english_1842': '基本英単語（english_1842）',
  'dict.bundled.security': 'セキュリティ・暗号用語（security）',
  'dict.bundled.animals': '動物名（animals）',
  'dict.bundled.poe': 'エドガー・アラン・ポーの作品名と語彙（EdgarAllanPoe）',
  'dict.pasted': '貼り付けた辞書 {n}',
  'dict.none': '辞書未選択',
  'dict.loading': '読み込み中…',
  'dict.words': '{n} 語',
  'dict.wordsDetail': '{n} 語（{lines} 行から{removed}を除いた数）',
  'dict.removedDuplicates': '重複 {n} 行',
  'dict.removedInvalid': '英字のない {n} 行',
  'dict.removedJoin': '・',
  'dict.kindBuiltin': '内蔵',
  'dict.kindBundled': '付属',
  'dict.kindFile': 'ファイル',
  'dict.kindPaste': '貼り付け',
  'dict.notLoaded': '未読み込み（チェックすると読み込みます）',
  'dict.remove': '削除',
  'dict.removeLabel': '{name} を一覧から外す',
  'dict.useLabel': '{name} を探索に使う',
  'dict.fileProtocol': 'ファイルとして直接開いているため、付属辞書は読み込めません（ブラウザーが file:// からの読み込みを止めます）。'
    + '自分の辞書はファイル選択か貼り付けで使えます。付属辞書を使うには、公開版か、フォルダーで python -m http.server を実行して http://localhost:8000/ で開いてください。',
  'dict.statusLoaded': '「{name}」を読み込みました（{n} 語）。いま使っている辞書は合計 {total} 語です',
  'dict.statusToggled': 'いま使っている辞書は合計 {total} 語です',
  'dict.statusRemoved': '「{name}」を一覧から外しました。いま使っている辞書は合計 {total} 語です',
  'dict.statusReplaced': '同じ名前の「{name}」を新しい内容に置き換えました（{n} 語）',
  'dict.errorNoFile': '辞書ファイルを選んでください',
  'dict.errorTooLarge': 'ファイルが大きすぎます（{size}。上限は {limit}）',
  'dict.errorTooManyWords': '語が多すぎます（{n} 語。上限は {limit} 語）',
  'dict.errorEmpty': '英字の語が1つもありませんでした（1行に1語のテキストファイルを選んでください）',
  'dict.errorRead': '読み込めませんでした（{detail}）',
  'dict.errorFetch': '「{name}」を読み込めませんでした（{detail}）',
  'dict.errorPasteEmpty': '貼り付ける語を入力してください（1行に1語）',
  // 入力の確認
  'input.empty': '英字を入力してください',
  'input.tooLong': '英字が多すぎます（{n} 字。上限は {limit} 字）',
  'input.ignored': '英字でない文字 {n} 字を無視しました',
  'filter.minLen': '最小の長さは 1〜{limit} の整数で入力してください',
  'filter.maxLen': '最大の長さは 1〜{limit} の整数で入力するか、空欄にしてください',
  'filter.range': '最小の長さ（{min}）が最大の長さ（{max}）より大きくなっています',
  'limit.invalid': '表示の上限は 1〜{limit} の整数で入力してください',
  'search.noDictionary': '使う辞書がありません。「辞書設定」で辞書を選んでください',
  // 結果
  'kind.exact': '全文字',
  'kind.partial': '一部',
  'result.restNone': '—',
  'result.lookup': '英辞郎で {word} を調べる（新しいタブ）',
  'result.singleSummary': '{letters}（{len} 字、署名 {sig}）: 全文字を使う語 {exact}、一部の文字を使う語 {partial}',
  'result.shown': '{total} 件中 {shown} 件を表示',
  'result.shownAll': '{total} 件を表示',
  'result.hiddenPartial': '（一部の文字を使う語 {n} 件は非表示）',
  'result.pairSummary': '{letters}（{len} 字、署名 {sig}）: {pairs} 組。1語目の候補 {first} 語それぞれについて、残りの文字の署名で2語目を引きました',
  'result.none': '見つかりませんでした',
  'result.stale': '辞書が変わったため、この結果は前の辞書で探したものです。もう一度「探索」を押すと新しい辞書で探します',
  'result.pairLengths': '{a}＋{b}',
  'export.nothing': '書き出す結果がありません',
  // テーマ
  'theme.toDark': 'ダークモードに切り替える',
  'theme.toLight': 'ライトモードに切り替える'
};

const EN = {};

export const MESSAGES = { ja: JA, en: EN };
export const LANGUAGES = ['ja', 'en'];

let current = 'ja';

export function setLanguage(lang) {
  if (LANGUAGES.includes(lang)) current = lang;
  return current;
}

export function getLanguage() {
  return current;
}

export function t(key, params = {}, lang = current) {
  const table = MESSAGES[lang] || JA;
  let text = table[key] ?? JA[key];
  if (text === undefined) return key;
  for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
  return text;
}
