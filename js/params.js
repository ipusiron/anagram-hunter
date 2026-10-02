// URL のクエリーで入力を受け取る（ほかのツールから文字列を渡して開くため）。例: ?text=DORMITORY&tab=two-word
// text は最初の400字まで。tab が一覧にないとき、text があれば単語アナグラムのタブで開く

export const PARAM_TABS = ['single', 'two-word', 'phrase', 'builder', 'compare'];
export const MAX_PARAM_TEXT = 400;

export function readParams(search) {
  const q = new URLSearchParams(search || '');
  const raw = q.get('text');
  const text = raw !== null && raw.trim() ? raw.slice(0, MAX_PARAM_TEXT) : null;
  const asked = q.get('tab');
  const tab = PARAM_TABS.includes(asked) ? asked : null;
  return { text, tab: text ? tab || 'single' : null };
}
