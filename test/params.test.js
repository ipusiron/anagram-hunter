import test from 'node:test';
import assert from 'node:assert/strict';
import { readParams, urlWithoutText, PARAM_TABS, MAX_PARAM_TEXT } from '../js/params.js';

test('?text= と ?tab= で入力を受け取る。tab が一覧にないとき、text があれば単語アナグラム', () => {
  assert.deepEqual(readParams('?text=DORMITORY&tab=two-word'), { text: 'DORMITORY', tab: 'two-word' });
  assert.deepEqual(readParams('?text=ELEVEN%20PLUS%20TWO&tab=phrase'), { text: 'ELEVEN PLUS TWO', tab: 'phrase' });
  assert.deepEqual(readParams('?text=listen'), { text: 'listen', tab: 'single' });
  assert.deepEqual(readParams('?text=listen&tab=dictionary'), { text: 'listen', tab: 'single' });
  assert.deepEqual(readParams('?text=listen&tab=<script>'), { text: 'listen', tab: 'single' });
  assert.deepEqual(readParams('?tab=phrase'), { text: null, tab: null });
  assert.deepEqual(readParams('?text=%20%20'), { text: null, tab: null });
  assert.deepEqual(readParams(''), { text: null, tab: null });
  assert.equal(readParams(`?text=${'A'.repeat(1000)}`).text.length, MAX_PARAM_TEXT);
  assert.deepEqual(PARAM_TABS, ['single', 'two-word', 'phrase', 'builder', 'compare']);
});

test('#text= を先に読み、tab も同じ場所から。なければ ?text=。読み込んだ text は「?」と「#」の両方から消す', () => {
  assert.deepEqual(readParams('?text=QUERY&tab=phrase', '#text=HASH&tab=two-word'), { text: 'HASH', tab: 'two-word' });
  assert.deepEqual(readParams('?text=QUERY', ''), { text: 'QUERY', tab: 'single' });
  assert.equal(readParams('', `#text=${'A'.repeat(1000)}`).text.length, MAX_PARAM_TEXT);
  const base = 'https://ipusiron.github.io/anagram-hunter/';
  assert.equal(urlWithoutText(`${base}?text=ABC&tab=phrase&lang=en`), '/anagram-hunter/?tab=phrase&lang=en');
  assert.equal(urlWithoutText(`${base}?lang=en#text=ABC&tab=two-word`), '/anagram-hunter/?lang=en#tab=two-word');
  assert.equal(urlWithoutText(`${base}#text=ABC`), '/anagram-hunter/');
  assert.equal(urlWithoutText(`${base}?lang=en#top`), null);
});
