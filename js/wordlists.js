// 辞書の一覧（DOM 非依存）。付属辞書は wordlists/ のテキストファイル（1行に1語）を fetch で読む。
// words＝正規化（A〜Z の大文字、重複を除く）したあとの語数。test/wordlists.test.js が実ファイルと突き合わせる

// 内蔵ミニ辞書（読み込みなしで使える例の語）
export const BUILTIN_WORDS = [
  'LISTEN', 'SILENT', 'ENLIST', 'INLETS',
  'STONE', 'NOTES', 'TONES',
  'APPLE', 'PEAL', 'PALE', 'LEAP', 'PLEA',
  'TEAM', 'MEAT', 'MATE', 'TAME',
  'RATE', 'TEAR', 'TARE'
];

export const BUNDLED_WORDLISTS = [
  { id: 'english_5067', file: 'wordlists/english_5067.txt', lines: 5068, words: 2945 },
  { id: 'english_1842', file: 'wordlists/english_1842.txt', lines: 1842, words: 1472 },
  { id: 'security', file: 'wordlists/security.txt', lines: 1189, words: 1189 },
  { id: 'animals', file: 'wordlists/animals.txt', lines: 695, words: 546 },
  { id: 'poe', file: 'wordlists/EdgarAllanPoe.txt', lines: 1197, words: 1008 },
  // 12dicts 6.0.2 の 3of6game（Alan Beale、公有）。出典と SHA-256 は wordlists/12dicts-NOTICE.md
  { id: 'twelvedicts', file: 'wordlists/12dicts-3of6game.txt', lines: 64662, words: 64662 }
];

// HTTP(S) で開いたときに最初から読み込む付属辞書（一般的な英単語）
export const DEFAULT_WORDLISTS = ['english_5067', 'english_1842'];

// 利用者が読み込む辞書ファイルの上限
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DICTIONARY_WORDS = 500000;
// 画面に出す辞書名の最大の長さ（ファイル名が長すぎるときは切る）
export const MAX_NAME_LENGTH = 80;

export function bundledById(id) {
  return BUNDLED_WORDLISTS.find((w) => w.id === id) || null;
}

// ファイル名を辞書名にする。制御文字を空白にして、長すぎれば末尾を…で切る（表示は textContent で行う）
export function displayName(name) {
  const clean = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return clean.length > MAX_NAME_LENGTH ? `${clean.slice(0, MAX_NAME_LENGTH - 1)}…` : clean;
}
