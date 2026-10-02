# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anagram Hunter - 辞書の署名で探すアナグラム探索ツール. A static web app that finds single-word anagrams, every two-word pair, and phrases (up to five words) that use up exactly the input letters, using a dictionary index of letter signatures. It also has a builder mode (choose one word at a time) and a comparison of two strings. Japanese and English UI. Input and dictionaries never leave the browser.

## Architecture

- **index.html**: UI with six ARIA tabs (one word, two words, phrase, builder, compare, dictionaries). Static texts carry `data-i18n` / `data-i18n-attr` keys. Meta CSP without `'unsafe-inline'`; no inline handlers or style attributes
- **script.js**: UI entry (ES module). Builds tables and the dictionary list with `textContent` only, loads bundled wordlists with `fetch`, runs searches, handles exports, `?text=`/`?tab=`, and language switching (re-renders results from stored state)
- **js/anagram-core.js**: Pure logic (no DOM): `normalizeLetters` (NFKC + strip diacritics + A-Z), `normalizePattern`, `parseWordList`, `buildIndex`, `readFilters`, `findSingle`, `findPairs`, `findPhrases`, `removeWord`, `compareLetters`, `toCsv`
- **js/wordlists.js**: Built-in mini dictionary (19 words) and the bundled wordlist table (file, line count, unique word count). `twelvedicts` = 12dicts 3of6game (public domain, see `wordlists/12dicts-NOTICE.md`), not loaded by default
- **js/messages.js**: All UI strings, Japanese and English with identical keys. Logic returns keys and values only
- **js/i18n.js**: Initial language (`?lang=` → saved choice → browser language) and `applyStaticText`
- **js/params.js**: Reads `?text=` (max 400 chars) and `?tab=`
- **js/tabs.js / theme.js / theme-init.js / file-check.js**: Tabs with arrow keys, light/dark theme, notice when opened via `file://`
- **style.css**: Color tokens on `:root`, dark overrides for `data-theme="dark"` and `prefers-color-scheme`

### Algorithm Approach

1. **Single word**: one pass over the dictionary; a word fits if its letter counts are ≤ the input's. `rest` = leftover letters
2. **Two words**: for each fitting first word, the second word's signature equals the signature of the leftover letters, so one map lookup finds all second words. Exhaustive, no beam. Pairs are counted once
3. **Phrases**: candidates sorted longest first; only words at or after the previous word's position are chosen (no permutations); the last word is looked up by signature; each level passes on only candidates still coverable. Limits: 5,000 results, 2,000,000 steps, 3 s (UI) → `truncated`
4. **Filters**: min/max word length (applies to result words, not the input), starts with, ends with, contains, letter positions (`S?L???`)

See `ALGORITHM.md` for details (Japanese).

## Development Commands

- `npm test` — node:test, no dependencies, Node 22+. Runs in GitHub Actions on push and pull requests
- Serve over HTTP to run the UI: `python -m http.server 8000` → `http://localhost:8000/`. Chrome/Edge cannot load ES modules from `file://`; Firefox can, but bundled wordlists cannot be fetched there

## Testing

- `test/core.test.js`, `test/phrase.test.js`: normalization, signatures, filters, single/pair search (pairs compared with brute force), phrases (2-word phrases equal `findPairs`; include/exclude/repeat; truncation), compare, CSV, the large dictionary
- `test/wordlists.test.js`: bundled wordlist counts, known answers, SHA-256 of the 12dicts file (LF-normalized)
- `test/readme.test.js`: README.md and README.en.md (YAML structure in README.md only, same headings, tables, numbers in the text, directory trees, images); ALGORITHM.md numbers
- `test/html.test.js`, `test/contrast.test.js`, `test/messages.test.js`, `test/i18n.test.js`, `test/params.test.js`, `test/format.test.js`: CSP and markup, color contrast (4.5:1 text, 3:1 borders) and control sizes, strings kept in messages.js, JA/EN keys and no Japanese in English, URL parameters, minified-file detection

## Key Implementation Notes

- Never use `innerHTML` for user-provided data (dictionary names, words). Tests forbid `innerHTML` in the UI scripts
- Bundled wordlists are fetched only from the fixed list in `js/wordlists.js` (no free-form paths). User dictionaries come from file input or paste (10 MB / 500,000 words max)
- Add every new UI string to both `JA` and `EN` in `js/messages.js`; new static texts in index.html need `data-i18n`
- Keep the README YAML metadata structure (keys, order, block lists) unchanged; `readme.test.js` checks it. Keep README.md and README.en.md headings in the same order
- Update `BUNDLED_WORDLISTS` counts if a wordlist file changes (tests compare them with the files)
