// URL の「#」より後ろ（または「?」より後ろ）で入力を受け取る（ほかのツールから文字列を渡して開くため）。例: #text=DORMITORY&tab=two-word
// 「#」より後ろはサーバーへ送られず、GitHub Pages の URL の長さの上限（パスと「?」以降で8,192バイト）も受けない
// text は最初の400字まで。tab が一覧にないとき、text があれば単語アナグラムのタブで開く

export const PARAM_TABS = ['single', 'two-word', 'phrase', 'builder', 'compare'];
export const MAX_PARAM_TEXT = 400;

export function readParams(search, hash = '') {
  const fromHash = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const q = fromHash.has('text') ? fromHash : new URLSearchParams(search || '');
  const raw = q.get('text');
  const text = raw !== null && raw.trim() ? raw.slice(0, MAX_PARAM_TEXT) : null;
  const asked = q.get('tab');
  const tab = PARAM_TABS.includes(asked) ? asked : null;
  return { text, tab: text ? tab || 'single' : null };
}

// 読み込んだ text を「?」と「#」の両方から消したときのパス（tab などほかの値は残す）。text がなければ null。
// アドレスバー・ブックマーク・URL のコピーに入力を残さないため（シリーズのほかの受け手と同じ）
export function urlWithoutText(href) {
  const url = new URL(href);
  const fromHash = new URLSearchParams(url.hash.slice(1));
  const inHash = fromHash.has('text');
  if (!url.searchParams.has('text') && !inHash) return null;
  url.searchParams.delete('text');
  fromHash.delete('text');
  const hash = inHash ? fromHash.toString() : url.hash.slice(1);
  return url.pathname + url.search + (hash ? `#${hash}` : '');
}
