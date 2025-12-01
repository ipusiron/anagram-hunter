# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anagram Hunter - 高速アナグラム探索ツール。A JavaScript-based web application for finding anagrams using dictionary lookup with signature indexing for performance optimization.

## Architecture

The application is a single-page web app with three main files:
- **index.html**: UI structure with tab-based interface (single word, two-word, passphrase, dictionary settings)
- **script.js**: Core logic implementing anagram search algorithms, dictionary indexing, and filtering
- **style.css**: Light theme styling

### Key Data Structures

- **SIG2WORDS Map**: Maps sorted character signatures (e.g., "LISTEN" → "EILNST") to word arrays for O(1) exact anagram lookup
- **WORD_FREQ Map**: Caches 26-dimensional frequency vectors for each word for efficient substring checks
- **WORDS Array**: Normalized dictionary words (A-Z only, uppercase)
- **DICT_SOURCES Array**: Multiple dictionary sources with name, words array, and enabled state

### Algorithm Approach

1. **Single-word anagrams**: Uses signature matching for exact-length matches and frequency vector coverage for sub-anagrams
2. **Two-word anagrams**: Beam search with configurable width and top-N pruning to limit search space
3. **Filtering**: Length constraints, prefix/suffix matching, substring containment

For detailed algorithm documentation, see `ALGORITHM.md`.

## Development Commands

This is a static HTML/JavaScript application with no build process required. To run:
- Open `index.html` directly in a browser
- Or serve via any static file server (e.g., `python -m http.server 8000`)

Note: Loading external dictionaries via fetch requires a web server due to CORS.

## Testing Approach

No automated tests currently exist. Manual testing involves:
1. Loading dictionary files (TXT format, one word per line) from `wordlists/` directory
2. Testing various input strings and filter combinations
3. Verifying anagram results and export functionality (CSV/JSON)

## Key Implementation Notes

- All input is normalized to A-Z uppercase only via `sanitizeLetters()`
- Dictionary words are deduplicated and normalized on load via `rebuildDictStructures()`
- Performance optimized using signature indexing and frequency vector pre-computation
- Two-word search uses beam width limiting (default 200) to prevent exponential complexity
- Multiple dictionaries can be loaded simultaneously with individual enable/disable toggles