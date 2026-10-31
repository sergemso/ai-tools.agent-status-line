# Architecture

```
                 ┌─────────────────────────────────────────┐
                 │              @statusline/core           │   ← reusable library
                 │  sections · priority-layout · renderers │
                 └────────────────▲────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
   ┌────────┴────────┐  ┌─────────┴─────────┐  ┌────────┴────────────┐
   │ claude-code     │  │ cursor            │  │ opencode-plugin     │
   │ adapter         │  │ adapter           │  │ (in-process TUI)    │
   └────────┬────────┘  └─────────┬─────────┘  └─────────────────────┘
            │                     │
            └──────────┬──────────┘
                       │
              ┌────────▼────────┐
              │  formatter.ts   │  ← section-priority pipeline
              │  (fallback to   │
              │   legacy)       │
              └────────┬────────┘
                       │
                  ANSI string
```

**Monorepo layout:**

```
packages/
  core/                  @statusline/core — sections, layout engine, renderers
  opencode-plugin/       @statusline/opencode-plugin — OpenCode TUI plugin
commands/                Claude Code slash commands (/statusline:setup, /statusline:config)
hooks/                   Claude Code SessionStart hook (keeps the copied binary current)
.claude-plugin/          plugin.json + marketplace.json for the Claude Code marketplace
scripts/                 one-shot installers (Claude Code, Cursor, OpenCode)
docs/                    adapters, configuration, multi-agent, releasing
src/
  adapters/              claude-code.ts, cursor.ts, adapter registry
  formatter.ts           new section-priority pipeline
  formatter.legacy.ts    preserved as the error fallback only
  statusline.ts          CLI entry: parse → format → output
  shared/                constants, colors, formatting, prices, terminal
test/
  fixtures/              JSON fixtures per agent (Claude Code, Cursor)
  integration/           end-to-end + formatter tests via the CLI binary
```

**Key design decisions:**

- **Section-priority pipeline:** sections declare a `Priority` (NONE→CRITICAL). On overflow, the layout engine drops lowest-priority items first; CRITICAL items can evict lower-priority ones.
- **No longer legacy-identical:** this fork changed the item labels, cost formats, grouping, separators and drop order, so the pipeline does not match `formatter.legacy.ts` byte for byte. The legacy formatter remains only as the error fallback.
- **Grouping and priorities:** `regroup()` in `packages/core/src/sections/index.ts` merges the built-in sections into groups by item key, and gives every group the same priority so item priority alone decides what drops first. The layout (`packages/core/src/layout.ts`) drops in strict order: after the first item that does not fit, everything ranked below it is dropped too. Item priorities live in the section files.
- **Restart economics:** `⚡`, `⇲` and `⟲` are computed in `calculateOverhead` (`src/formatter.ts`) from the price table, `recache_tokens_if_cold`, the cache TTL and the `FRESH_TOKENS` / `SUMMARY_TOKENS` settings. Price-table loading (`src/shared/prices.ts`) always uses the file on disk, however old; the refresh (`src/refresh-prices.ts`) rejects tables that do not look like Claude model prices.
- **Unicode-aware width:** CJK/emoji count as 2 display columns, combining marks as 0 — so the layout engine makes correct compaction decisions for all content.
