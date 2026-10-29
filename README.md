# claude-code-status-line

A rich, single-line status bar for **Claude Code**, **Cursor**, and **OpenCode** — model and price multiplier, context usage, session cost, prompt-cache timer, rate-limit resets. Self-shrinking on narrow terminals. TypeScript, zero runtime deps.

```text
Sonnet 5.5 hi | ▕▄▏ 42%/200k +1¢/call new@9 | $5.60 sess | ⏱ 25m | 12% 4h 59m / 5h | 55% 6d 23h / 7d
```

[Quickstart](#quickstart) · [What you get](#what-you-get) · [Agents](#agents) · [Configuration](#configuration) · [Architecture](#architecture) · [Contributing](#contributing) · [Troubleshooting](#troubleshooting)

---

## Quickstart

Pick your agent — one command each:

| Agent | One-shot install |
|---|---|
| **Claude Code** | `curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-claude-code.sh \| bash` |
| **Cursor** | `curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-cursor.sh \| bash` |
| **OpenCode** (TUI) | `curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-opencode.sh \| bash` |

Each script clones the repo, builds the binary, and prints exactly what to add to your agent's settings. Restart the agent after — done.

**Prefer manual?** See [Manual setup](#manual-setup) below.

**Requirements:** Node.js ≥ 18, `git`. No `jq`, `curl`, or `awk` (the old bash version needed them; the TypeScript rewrite doesn't).

---

## What you get

One line, ~90 columns by default, that shows:

| Section | What it shows | Color cues |
|---|---|---|
| **Model** | Active model + price multiplier (`x5` = 5× your base model's input price) + effort level (`lo`/`med`/`hi`/`xhi`/`max`) | model cyan · effort: dim→green→yellow→red |
| **Context** | 3-char bar (`▕▁▏`–`▕█▏`), percent used, window size | 🟩 < 50% · 🟨 ≥ 50% · 🟥 ≥ 80% |
| **Overhead** | Extra cost per call of re-reading this session vs a fresh one (`+1¢/call new@9`); cold-cache penalty (`cold +24¢`); compaction cost (`compact 38¢`) | 🟩 < 5¢ · 🟨 < 20¢ · 🟥 ≥ 20¢ |
| **Session cost** | USD spent in the current session | plain, dim `sess` |
| **Prompt cache** | `⏱ 25m` = minutes until cache expires, `⏱ cold` when expired, hit rate when < 80% | 🟩→🟨→🟥 as expiry approaches |
| **Rate-limit resets** | Used % + time-to-reset for 5h, 7d, spend windows | 🟩 < 50% · 🟨 ≥ 50% · 🟥 ≥ 80% |

**Smart shrinking:** on a narrow terminal, sections drop one at a time (cache → tokens → overhead → cost → secondary windows → …) until the line fits. Six compaction levels, all configurable.

**Auto price refresh:** model prices are fetched from Anthropic's public pricing page and cached in `~/.claude/model-prices.json` (re-fetched every hour by default).

---

## Agents

The plugin auto-detects which coding agent is feeding it data and adapts the output. Three agents are supported:

| Agent | Status | How it works | Onboarding |
|---|---|---|---|
| **Claude Code** | ✅ Built-in | External command: Claude Code pipes JSON to stdin, plugin returns an ANSI string. Configured via `settings.json` `statusLine.command`. | one-shot script or `bin/statusline install --configure` |
| **Cursor** | ✅ Built-in | Same external-command contract, with Cursor-specific fields (`render_width_chars`, `autorun`, `max_mode`, `param_summary`). | one-shot script, then add JSON snippet to Cursor settings |
| **OpenCode** | ✅ Plugin (`@statusline/opencode-plugin`) | OpenCode v2 has no external-command contract; instead it loads in-process TUI plugins that claim a footer slot. TUI mode only — not ACP. | one-shot script, then add plugin path to `opencode.json` |

**Add a new agent:** implement the `StatusLineAdapter` interface (see [`docs/adding-adapters.md`](docs/adding-adapters.md)). Detection is automatic via `canHandle()`.

Check what's registered:

```bash
statusline agent list
statusline agent detect path/to/input.json
```

### Manual setup

If the one-shot scripts don't fit your workflow, here's the manual path for each agent.

**Shared first step** — clone + build:

```bash
git clone https://github.com/sergemso/claude-code-status-line.git
cd claude-code-status-line
npm install        # postinstall hook builds the binary automatically
```

**Claude Code** — one command wires up `~/.claude/settings.json`:

```bash
./bin/statusline install --configure
# → restart Claude Code
```

**Cursor** — copy the binary and add a settings entry:

```bash
mkdir -p ~/.claude/statusline
cp bin/statusline ~/.claude/statusline/
chmod +x ~/.claude/statusline/statusline
```

Then add to your Cursor `settings.json` (location varies by OS — see `scripts/install-cursor.sh` for paths):

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline/statusline"
  }
}
```

**OpenCode (TUI)** — build the plugin and register it:

```bash
npm run build --workspace=@statusline/opencode-plugin
```

Then add to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/claude-code-status-line/packages/opencode-plugin/dist/index.js"
  ]
}
```

Run `opencode` (TUI mode) — the status line appears in the footer. **ACP mode (`opencode acp`) is not supported** — the editor renders its own UI there.

### Updates

```bash
cd ~/.claude/claude-code-status-line   # or wherever you cloned
git pull
npm install        # postinstall rebuilds if needed
# Claude Code: no further action (settings.json points at the stable copy)
# Cursor / OpenCode: re-copy the binary or rebuild the plugin
```

---

## Configuration

Three layers, in priority order: **env var** > **config file** > **defaults**.

### CLI

```bash
statusline config show                        # see current settings + their source
statusline config model "Claude Opus 5.5"     # base model for price multiplier
statusline config sections show stats         # always show cache hit rate
statusline config sections only model context cost  # minimal line
statusline config resets 5h,7d,spend          # which reset windows to show
statusline config thresholds context 60 85    # yellow at 60%, red at 85%
statusline config width 100                   # or: auto
statusline config margin 2                    # right-edge padding
statusline config dump /tmp/sl.txt            # debug: raw JSON + width diagnostics
statusline config reset                       # drop all saved settings
```

### Environment variables

Any setting can be overridden via `STATUSLINE_<KEY>` (e.g. `STATUSLINE_RESETS`, `STATUSLINE_CONTEXT_WARN`). Set them in the `env` block of `~/.claude/settings.json`:

```json
{
  "env": {
    "STATUSLINE_RESETS": "5h,7d,spend",
    "STATUSLINE_CONTEXT_WARN": "60",
    "STATUSLINE_CUSTOM_RESET": "sprint|2026-10-17 09:00"
  }
}
```

| Variable | Meaning |
|---|---|
| `STATUSLINE_CUSTOM_RESET` | `label\|YYYY-MM-DD HH:MM` — adds a custom countdown section |
| `STATUSLINE_PRICES_TTL` | Seconds before price table re-fetch (default 3600) |
| `STATUSLINE_DUMP` | Same as `config dump PATH` |
| `CLAUDE_CONFIG_DIR` | Config directory (default `~/.claude`) |

### Sections reference

| Name | Default | Shows |
|---|---|---|
| `model` | on | Model name, price multiplier, effort level |
| `context` | on | Context bar + % + window size |
| `overhead` | on | Re-read cost vs fresh session, cold-cache penalty, compaction cost |
| `cost` | on | Session cost in USD |
| `cache` | on | Prompt-cache timer + (optionally) hit rate |
| `stats` | off | Always show cache hit rate (default: only when < 80%) |
| `tokens` | off | Total session tokens (mirrors context %) |
| `resets` | on | Rate-limit reset windows |

---

## Architecture

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
src/
  adapters/              claude-code.ts, cursor.ts, adapter registry
  formatter.ts           new section-priority pipeline
  formatter.legacy.ts    preserved for fallback + golden comparisons
  statusline.ts          CLI entry: parse → format → output
  shared/                constants, colors, formatting, prices, terminal
test/
  fixtures/              15 JSON fixtures (8 Claude Code + 7 Cursor)
  integration/           end-to-end + formatter tests via the CLI binary
```

**Key design decisions:**

- **Section-priority pipeline:** sections declare a `Priority` (NONE→CRITICAL). On overflow, the layout engine drops lowest-priority items first; CRITICAL items can evict lower-priority ones.
- **Byte-for-byte legacy parity:** the new pipeline is designed to match `formatter.legacy.ts` exactly. Golden tests are planned (see [Contributing](#contributing)).
- **Unicode-aware width:** CJK/emoji count as 2 display columns, combining marks as 0 — so the layout engine makes correct compaction decisions for all content.

---

## Contributing

Contributions welcome — bug reports, fixtures, new adapters, renderer improvements, docs.

### Setup

```bash
git clone https://github.com/sergemso/claude-code-status-line.git
cd claude-code-status-line
npm install
npm run build:core    # build @statusline/core first (other packages depend on it)
npm run build         # build the main CLI
npm test              # 202 tests across 10 files
```

### Common tasks

| Task | Command |
|---|---|
| Run tests once | `npm test` |
| Watch tests | `npm run test:watch` |
| Build core only | `npm run build:core` |
| Build everything | `npm run build` |
| Lint | `npm run lint` |
| Add a test fixture | drop a JSON file in `test/fixtures/<agent>/`, add it to the loop in `test/adapters/adapter.test.ts` |

### Adding a new agent adapter

1. Read [`docs/adding-adapters.md`](docs/adding-adapters.md) — step-by-step guide.
2. Create `src/adapters/<agent>.ts` implementing `StatusLineAdapter`.
3. Register in `src/adapters/index.ts` (more specific adapters first).
4. Add fixtures in `test/fixtures/<agent>/` (basic, full, edge-empty, edge-null at minimum).
5. Run `npm test` — your adapter is auto-covered by the registry tests.

### Good first issues

- **Golden tests:** add `expect(newOutput).toBe(legacyOutput)` assertions on all fixtures to formally prove byte-for-byte equivalence between the new pipeline and `formatter.legacy.ts`.
- **Remove `formatter.legacy.ts`:** once golden tests stabilize, delete the legacy formatter and the fallback path.
- **Type safety:** replace `any` in `adaptInputForCore()` / `RenderContext.input` with a typed `CoreRenderInput`.
- **CI hardening:** add `npm run lint` and `tsc --noEmit` as separate required gates in `.github/workflows/ci.yml`.
- **New renderer:** VS Code / Neovim renderers exist in `@statusline/core` but have no integration tests.

### Commit style

Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`). Keep commits focused; squash before merge if the history is noisy.

### Pull requests

- One concern per PR. Large multi-phase refactors should be split.
- Include tests for new behavior. New adapters need fixtures.
- Update docs (`docs/`, `README.md`) if you change user-facing behavior.
- `npm test` must pass. `npm run build` must succeed.

### License

MIT — see [LICENSE](LICENSE).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Status line doesn't appear | Restart Claude Code. Check `~/.claude/settings.json` has a `statusLine` entry. Re-run `node dist/index.js install --force --configure`. |
| `node: ERR_MODULE_NOT_FOUND` | You ran `node dist/index.js` directly — the unbundled dist can't resolve workspace deps. Use the bundled `bin/statusline` instead, or run via `npm run dev` / `tsx src/index.ts`. |
| Reset windows are missing | They exist on subscription accounts only (enterprise / API-key sessions get no `rate_limits` from Claude Code). Run `statusline config dump /tmp/sl.txt` to see what your account sends. |
| Line never shrinks on narrow terminals | Width couldn't be read from the tty. Set it manually: `statusline config width 100`. |
| Price multiplier says `x2.0` unexpectedly | It's relative to your base model (default Sonnet 5.5). Change it: `statusline config model "Claude Opus 5.5"`. |
| A setting seems ignored | An env var `STATUSLINE_<KEY>` beats the saved value. `statusline config show` lists each value and its source. |
| `⏱ cold` never turns into a countdown | The prompt cache has expired or hasn't been written yet; it recovers after the next request. |
| OpenCode plugin doesn't load | It only works in **TUI mode** (`opencode`), not ACP mode (`opencode acp`). See [`packages/opencode-plugin/README.md`](packages/opencode-plugin/README.md). |

---

## Credits

Authored by [sergemso](https://github.com/sergemso). TypeScript rewrite and multi-agent architecture built on the section-priority rendering pipeline from `@statusline/core`.
