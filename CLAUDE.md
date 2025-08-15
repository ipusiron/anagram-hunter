# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anagram Hunter - 高速アナグラム探索ツール。A JavaScript-based web application for finding anagrams using dictionary lookup with signature indexing for performance optimization.

## Architecture

The application is a single-page web app with three main files:
- **index.html**: UI structure with input fields for letters/filters, result table, and dictionary loading controls
- **script.js**: Core logic implementing anagram search algorithms, dictionary indexing, and filtering
- **style.css**: Dark theme styling

### Key Data Structures

- **SIG2WORDS Map**: Maps sorted character signatures to word arrays for O(1) exact anagram lookup
- **WORD_FREQ Map**: Caches 26-dimensional frequency vectors for each word for efficient substring checks
- **WORDS Array**: Normalized dictionary words (A-Z only, uppercase)

### Algorithm Approach

1. **Single-word anagrams**: Uses signature matching for exact-length matches and frequency vector coverage for sub-anagrams
2. **Two-word anagrams**: Beam search with configurable width and top-N pruning to limit search space

## Development Commands

This is a static HTML/JavaScript application with no build process required. To run:
- Open `index.html` directly in a browser
- Or serve via any static file server (e.g., `python -m http.server 8000`)

## Testing Approach

No automated tests currently exist. Manual testing involves:
1. Loading dictionary files (TXT format, one word per line)
2. Testing various input strings and filter combinations
3. Verifying anagram results and export functionality

## Key Implementation Notes

- All input is normalized to A-Z uppercase only
- Dictionary words are deduplicated and normalized on load
- Performance optimized using signature indexing and frequency vector pre-computation
- Two-word search uses beam width limiting to prevent exponential complexity