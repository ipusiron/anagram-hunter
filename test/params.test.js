import test from 'node:test';
import assert from 'node:assert/strict';
import { readParams, PARAM_TABS, MAX_PARAM_TEXT } from '../js/params.js';

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
