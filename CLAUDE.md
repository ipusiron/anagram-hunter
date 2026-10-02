# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anagram Hunter - 辞書の署名で探すアナグラム探索ツール。A static web app that finds single-word anagrams and every two-word combination that uses up the input letters, using a dictionary index of letter signatures. Input and dictionaries never leave the browser.

## Architecture

- **index.html**: UI with three ARIA tabs (single word, two words, dictionary settings). Meta CSP without `'unsafe-inline'`; no inline handlers or style attributes
- **script.js**: UI entry (ES module). Builds tables and the dictionary list with `textContent` only, loads bundled wordlists with `fetch`, handles exports
- **js/anagram-core.js**: Pure logic (no DOM): `normalizeLetters` (NFKC + strip diacritics + A-Z), `parseWordList`, `buildIndex`, `readFilters`, `findSingle`, `findPairs`, `toCsv`
- **js/wordlists.js**: Built-in mini dictionary (19 words) and the bundled wordlist table (file, line count, unique word count)
- **js/messages.js**: All UI strings (Japanese; English is planned). Logic returns keys and values only
- **js/tabs.js / theme.js / theme-init.js / file-check.js**: Tabs with arrow keys, light/dark theme, notice when opened via `file://`
- **style.css**: Color tokens on `:root`, dark overrides for `data-theme="dark"` and `prefers-color-scheme`

### Key Data Structures

- **bySignature Map**: sorted-letter signature (e.g. "LISTEN" → "EILNST") → words
- **freq Map**: word → 26-element `Uint8Array` letter counts
- **words Array**: normalized (A-Z, uppercase), de-duplicated words from all enabled dictionaries

### Algorithm Approach

1. **Single word**: one pass over the dictionary; a word fits if its letter counts are ≤ the input's. `rest` = leftover letters
2. **Two words**: for each fitting first word, the second word's signature equals the signature of the leftover letters, so one map lookup finds all second words. Exhaustive, no beam. Pairs are counted once (alphabetical order)
3. **Filters**: min/max word length (applies to result words, not the input), starts with, ends with, contains

See `ALGORITHM.md` for details.

## Development Commands

- `npm test` — node:test, no dependencies, Node 22+. Runs in GitHub Actions on push and pull requests
- Serve over HTTP to run the UI: `python -m http.server 8000` → `http://localhost:8000/`. Chrome/Edge cannot load ES modules from `file://`; Firefox can, but bundled wordlists cannot be fetched there

## Testing

- `test/core.test.js`: normalization, signatures, filters, single/pair search (pairs are compared with brute force), CSV
- `test/wordlists.test.js`: bundled wordlist counts and known answers (DORMITORY → DIRTY ROOM etc.)
- `test/readme.test.js`: README YAML structure, section order, tables (bundled wordlists, pairs), directory tree, images; ALGORITHM.md numbers
- `test/html.test.js`, `test/contrast.test.js`, `test/messages.test.js`, `test/format.test.js`: CSP and markup, color contrast (4.5:1 text, 3:1 borders), strings kept in messages.js, minified-file detection

## Key Implementation Notes

- Never use `innerHTML` for user-provided data (dictionary names, words). Tests forbid `innerHTML` in the UI scripts
- Bundled wordlists are fetched only from the fixed list in `js/wordlists.js` (no free-form paths). User dictionaries come from file input or paste (10 MB / 500,000 words max)
- Keep the README YAML metadata structure (keys, order, block lists) unchanged; `readme.test.js` checks it
- Update `BUNDLED_WORDLISTS` counts if a wordlist file changes (tests compare them with the files)
