# @statusline/core

Core library for section-priority-based status line rendering.

## Overview

This package provides the foundational building blocks for rendering rich, adaptive status lines across different coding agents (Claude Code, Cursor, OpenCode).

## Features

- **Section-priority pipeline**: Sections declare priority levels; layout engine drops lowest-priority items first on narrow terminals
- **Unicode-aware width calculation**: Correctly handles CJK characters, emoji, and combining marks
- **Multiple renderers**: CLI (ANSI), VS Code, Neovim, OpenCode TUI
- **Zero runtime dependencies**: Pure TypeScript, compiled to ESM
- **Configurable sections**: Model, context, cost, cache, rate limits, tokens, worktree, vim mode

## Installation

```bash
npm install @statusline/core
```

## Usage

```typescript
import { getSections, buildLayout, cliRenderer } from '@statusline/core';

const sections = getSections(input);
const layout = buildLayout(sections, { width: 120 });
const output = cliRenderer(layout);
```

## Sections

| Section | Description |
|---------|-------------|
| `model` | Model name, price multiplier, effort level |
| `context` | Context window usage bar + percentage |
| `cost` | Session cost, next request cost, compaction cost, restart thresholds |
| `cache` | Prompt cache timer + hit rate |
| `resets` | Rate-limit reset windows |
| `tokens` | Total session tokens |
| `worktree` | Git branch / worktree info |
| `vim` | Vim mode indicator |

## Architecture

```
getSections(input) → Section[]
  │
  ├── modelSection()
  ├── contextSection()
  ├── costSection()  (overhead + cost)
  ├── cacheSection()
  ├── resetsSection()
  ├── tokensSection()
  ├── worktreeSection()
  └── vimSection()

buildLayout(sections, options) → Layout
  │
  ├── regroup() — merges sections into priority groups
  ├── measure() — calculates display width per item
  └── dropLowPriority() — strict priority-based truncation

cliRenderer(layout) → ANSI string
```

## License

MIT