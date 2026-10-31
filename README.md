# Agent status line

A rich, single-line status bar for **Claude Code**, **Cursor**, and **OpenCode** — model and price multiplier, context usage, session cost, prompt-cache timer, rate-limit resets. Self-shrinking on narrow terminals. TypeScript, no third-party runtime dependencies.

```text
Sonnet 5.5 hi | ▕▄▏ 42%/200k | Σ $5.6 ⚡ 3.6¢ ⇲ 25¢ ⟲ 7 9 | ⏱ 25m | 12% 4h59m/5h | 55% 6d23h/7d
```

[Quickstart](#quickstart) · [In 30 seconds](#in-30-seconds) · [Reading the line](#reading-the-line) · [Agents](#agents) · [Updating and uninstalling](#updating) · [Configuration](#configuration) · [Troubleshooting](#troubleshooting) · [Architecture](#architecture) · [Contributing](#contributing)

**Names, because there are three:** the GitHub repo and the Claude Code marketplace are `claude-code-status-line`; the npm packages are `@statusline/claude-plugin` (the CLI and Claude Code/Cursor binary), `@statusline/core` (the library) and `@statusline/opencode-plugin`; the Claude Code plugin itself is called `statusline`.

---

## Quickstart

**Requirements:** Node.js ≥ 18. The marketplace and script installs also need `git` (they build from source on first run); the npm install ships a prebuilt binary and needs only Node. No `jq`, `curl` or `awk`.

| Agent | Recommended | Alternatives |
|---|---|---|
| **Claude Code** | [Plugin marketplace](#claude-code--plugin-marketplace-recommended): auto-updates, slash commands | [npm](#claude-code--npm-pinned-no-auto-update) · [one-shot script](#claude-code--one-shot-script) · [manual](#manual-setup) |
| **Cursor** | [One-shot script](#cursor) | [manual](#manual-setup) |
| **OpenCode** (TUI) | `opencode plugin add @statusline/opencode-plugin` ([details](#opencode-tui)) | [one-shot script](#opencode-tui) |

### Claude Code — plugin marketplace (recommended)

```
/plugin marketplace add sergemso/claude-code-status-line
/plugin install statusline@claude-code-status-line
/statusline:setup
```

`/statusline:setup` builds the binary, copies it to `~/.claude/statusline/statusline` and writes the `statusLine` entry into `~/.claude/settings.json` (it refuses to overwrite a different status line unless you add `--force`). It then offers to walk you through customising. (`/statusline:uninstall` undoes it.) A SessionStart hook (`scripts/bootstrap.sh`) rebuilds the binary when the plugin updates. **Restart Claude Code** after the first install.

### Claude Code — npm (pinned, no auto-update)

```bash
npx @statusline/claude-plugin install --configure
```

This does the same copy-and-configure step as `/statusline:setup` from the published, prebuilt package: no git, no build. There is no auto-update and no slash commands; to update, run the same command again (add `@<version>` to pin one). Restart Claude Code afterwards. To keep the package itself around instead of using `npx`: `npm install --prefix ~/.claude/statusline/npm @statusline/claude-plugin`, then run `~/.claude/statusline/npm/node_modules/.bin/statusline install --configure`.

### Claude Code — one-shot script

```bash
curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-claude-code.sh | bash
```

Clones the repo to `~/.claude/claude-code-status-line`, builds it and runs `install --configure`. Updating means `git pull && npm install` in that directory.

### Check it works

After restarting your agent the line appears at the bottom of the prompt. To test the binary on its own, feed it a minimal Claude Code payload:

```bash
echo '{"model":{"id":"claude-sonnet-5-5","display_name":"Sonnet 5.5"},"cwd":"/tmp","cost":{"total_cost_usd":0.5},"context_window":{"context_window_size":200000,"used_percentage":12}}' \
  | ~/.claude/statusline/statusline
```

You should see something like `Sonnet 5.5 | ▕▁▏ 12%/200k | Σ 50¢`. Then run `~/.claude/statusline/statusline config show` to see your settings and where each comes from. Nothing showing? See [Troubleshooting](#troubleshooting).

### Make it yours

- `/statusline:config` inside Claude Code (guided), or
- `~/.claude/statusline/statusline config wizard` in a terminal: measures your real starting context, previews text styles at several widths, asks about base model and preset. See [Configuration](#configuration).

New to the symbols? Read [In 30 seconds](#in-30-seconds) next.

### Cursor

```bash
curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-cursor.sh | bash
```

Builds the binary, copies it to `~/.claude/statusline/`, and prints the JSON snippet to add to Cursor's `settings.json` (`~/.config/Cursor/User/settings.json` on Linux, `~/Library/Application Support/Cursor/User/settings.json` on macOS, `%APPDATA%\Cursor\User\settings.json` on Windows). Restart Cursor after. Cursor has no public plugin registry for status lines, so there is no marketplace route.

### OpenCode (TUI)

```bash
opencode plugin add @statusline/opencode-plugin
```

That adds the package to `~/.config/opencode/opencode.json`; run `opencode` and the line appears in the footer. The one-shot script (`scripts/install-opencode.sh`) does the same, and falls back to building from source if the package cannot be fetched. **TUI mode only**: `opencode acp` has no footer to draw into.

#### OpenCode options

OpenCode shows its own context, cost and `ctrl+p commands` on the right of the footer, so by default the line renders only `model,tokens,resets` there and leaves a two-column gap. To change that, register the plugin with options:

```jsonc
{
  "plugins": [
    {
      "package": "@statusline/opencode-plugin",
      "options": { "placement": "composer-top", "sections": "model,context,cost,tokens,resets" }
    }
  ]
}
```

`placement`: `replace` (default; takes over the footer status slot), `append` (adds to it) or `composer-top` (its own full-width row above the prompt). `sections` is a comma-separated list of `model`, `context`, `cost`, `tokens`, `resets`, `worktree`, … Full reference: [`packages/opencode-plugin/README.md`](packages/opencode-plugin/README.md).

---

## In 30 seconds

```text
Sonnet 5.5 med | ▕▂▏ 18%/1M | Σ 31¢ ⚡ 3.6¢ ⇲ 25¢ ⟲ 7 9 | ⏱ 25m
```

On a wide terminal the same line reads in words (`session 31¢ next call 3.6¢ … restart: maybe at 7, yes at 9 calls`); the symbols appear as the window narrows.

- **`⚡ 3.6¢`: what your next message costs just to re-read the conversation so far.** It grows with the context, and jumps when the cache goes cold.
- **`⟲ 7 9`: when to start fresh.** Expect fewer than 7 more messages: stay. 9 or more: a new session (or `/compact`) is cheaper. The numbers fall as the context grows. No `⟲` means a restart would not pay back soon.
- **`⏱ 25m`: how long the prompt cache stays warm.** After it goes cold (`⏱ cold`) the next message re-pays for the whole conversation, which is the moment to consider restarting.
- **`Σ 31¢`** is the session's total cost so far; **`⇲ 25¢`** is what a compaction would cost.

These are estimates (they ignore your prompt and the output, and assume a typical summary size), good for the shape of the decision rather than the exact bill. Run `statusline config wizard` to tune it, and read on for every indicator.

## Reading the line

Example, 180k tokens of context, warm cache, Sonnet pricing:

```text
Sonnet 5.5 med | ▕▁▏ 18%/1M | Σ 31¢ ⚡ 3.6¢ ⇲ 25¢ ⟲ 7 9 | ⏱ 25m
```

### Text styles: words, short, glyph

Every efficiency and cache item has three text forms. By default (`auto`) the line uses the most readable form in which everything fits your terminal width, and falls back towards glyphs as the window narrows; items start to drop only after the glyph form no longer fits.

| Item | words | short | glyph |
|---|---|---|---|
| Session cost | `session 31¢` | `31¢ total` | `Σ 31¢` |
| Next request | `next call 3.6¢` | `next 3.6¢` | `⚡ 3.6¢` |
| Compaction | `compact cost 25¢` | `compact 25¢` | `⇲ 25¢` |
| Restart thresholds | `restart: maybe at 7, yes at 9 calls` | `restart 7–9` | `⟲ 7 9` |
| Cache | `cache 25m` / `cache cold` | `cache 25m` / `cache cold` | `⏱ 25m` / `⏱ cold` |

A fourth style, **`ascii`**, uses plain ASCII only (`31c tot`, `nx 3.6c`, `cmp 27c`, `rst 7 10`, `[##--]` for the bar) for fonts or consoles that cannot show the symbols. `auto` never picks it by width; it is chosen automatically only when the environment cannot show Unicode (non-UTF-8 locale, or `TERM=linux`/`dumb`), and the wizard offers it when you say some symbols look broken. A symbol missing from a font cannot be detected by a program, which is why the wizard asks.

The words form needs roughly 120 columns, short about 100, glyph about 70. Force a style at any width:

```bash
statusline config format glyph                  # always compact, at any width
statusline config format words                  # always readable
statusline config format ascii                  # plain ASCII only
statusline config format auto                   # back to width-based (default)
statusline config format overhead glyph         # one section: cost, overhead, cache
statusline config format cost.session words     # one item (see `statusline config format` for the keys)
statusline config format cost.session default   # remove an override
```

Environment variables work too: `STATUSLINE_FORMAT=glyph`, `STATUSLINE_FORMATS=overhead=glyph,cost.session=words`. Precedence: item override, then section override, then the global format, then the width-based choice. A forced style never changes with width, so a forced `words` item can push other items off a narrow line. Without a detected terminal width, the line uses glyphs.

The examples in this README use the glyph form.

### Model group

| Indicator | Meaning |
|---|---|
| `Sonnet 5.5` | Active model (cyan). |
| `med` | Effort level: `lo` dim · `med` green · `hi` yellow · `xhi`/`max` red. |
| `x1.7` | Cost multiplier, only shown when not 1: **model input price ÷ base model input price** (`BASE_MODEL`, default Claude Sonnet 5.5) × the optional effort and peak-hour factors from `~/.claude/model-multipliers.json`. `x2` means this setup costs about twice what the base model would. |

Optional `~/.claude/model-multipliers.json` (not created for you; it is separate from `model-prices.json`, which is overwritten on every price refresh):

```json
{
  "Claude Opus 5.5": {
    "effort": { "high": 1.5 },
    "peak": { "rate": 2, "offRate": 1, "from": 13, "to": 19, "tz": "UTC", "weekdays": true }
  },
  "*": {}
}
```

`peak` applies `rate` between hours `from` (inclusive) and `to` (exclusive) in `tz`, on weekdays only when `weekdays` is true (default), and `offRate` otherwise (default 1). `"*"` is the fallback for models without an entry. The numbers are yours to supply; none are built in.

### Context group

| Indicator | Meaning |
|---|---|
| `▕▁▏ 18%/1M` | Context window use: bar, percent used, window size. 🟩 < 50% · 🟨 ≥ 50% · 🟥 ≥ 80%. |

### Session efficiency group

All costs are US dollars. Amounts under $1 show as whole cents (`31¢`); under 10¢ with one decimal (`3.6¢`); under 0.05¢ as `<.1¢`. $1 to $9.95 show one decimal (`$1.2`, trailing `.0` trimmed); from $9.95 up whole dollars (`$14`).

| Indicator | Meaning | How to use it |
|---|---|---|
| `Σ 31¢` | **Total cost of this session so far** (as reported by Claude Code). | Plain spend tracking. It only goes up. |
| `⚡ 3.6¢` | **Approximate cost of the next request's context**: the whole current context re-read from cache at 10% of the input price when the cache is warm, or re-written at the cache-write price (1.25× for a 5-minute cache, 2× for 1 hour) when it is cold. Your new prompt and the output tokens are **not** included. | It is a floor, not the exact bill. It grows with every turn. A jump (for example 3.6¢ → 72¢) means the cache expired and the next call re-pays for the whole context. Colours: 🟩 < 5¢ · 🟨 < 20¢ · 🟥 ≥ 20¢. |
| `⇲ 25¢` | **Cost of `/compact`-style restarts**: reading the current context once, generating a summary, and writing the new baseline (fresh + summary tokens). | The price of starting over with a summary. Compare with `⚡`: if one call costs far less than `⇲`, a restart takes several calls to pay back, which is what `⟲` works out. |
| `⟲ 7 9` | **Restart thresholds** in expected calls — see below. | Decide stay vs restart. |

#### `⟲ Y R` — when is a restart worth it?

Restarting costs `⇲` once and then each later call re-reads only a small baseline instead of the whole context. Staying costs the full context re-read on every call. So restarting is cheaper if you will make *enough more calls*. The two numbers say how many:

- **First number, yellow (`Y`)**: from this many expected calls on, restarting is within 30% of the cost of staying. Start thinking about it.
- **Second number, red (`R`)**: from this many expected calls on, restarting is cheaper than staying.
- **Below `Y`** (green, no number): staying is clearly cheaper over that many calls.
- Only one number (red): the yellow zone is empty, which is typical when the cache is cold (`⟲ 1` = restarting is already cheaper for even one more call).
- Item hidden: restarting would not pay back within 99 calls (small context), or the figures are unavailable.

How to read `⟲ 7 9`: "If I expect to make fewer than 7 more calls, stay. 7 to 8: a toss-up. 9 or more: restart." The numbers move as the context grows (they shrink) and when the cache goes cold (they collapse towards 1).

The model behind it, per expected call count `n`:

```text
stay    = ⚡ + (n − 1) × context-read cost
restart = ⇲ + n × (baseline + summary) read cost
```

Known simplifications: the context is assumed not to grow during those calls (this favours staying slightly); the cost of re-reading files and re-establishing state after a restart, and any loss of detail from the summary, are **not** priced (these also favour staying); output and new-input tokens are treated as equal in both cases and cancel. The baseline (`FRESH_TOKENS`, default 25,000) and summary length (`SUMMARY_TOKENS`, default 8,000) are estimates; change them with `statusline config` if your setup differs, for example a large `CLAUDE.md` plus many tools means a bigger baseline.

### Cache group

| Indicator | Meaning |
|---|---|
| `⏱ 25m` | Minutes until the prompt cache expires. 🟩→🟨→🟥 as expiry approaches. |
| `⏱ cold` | The cache has expired; the next call re-writes the whole context (watch `⚡`). `cold +62¢` shows the extra cost of that rewrite beyond a fresh baseline. |
| `97%` | Cache hit rate, shown only when below 80% unless the `stats` section is on. |

### Rate-limit resets group

| Indicator | Meaning |
|---|---|
| `12% 4h59m/5h` | Share of a rate-limit window used, time until it resets, and the window (`5h`, `7d`, `spend`). Only on subscription accounts: other sessions get no `rate_limits` from Claude Code. 🟩 < 50% · 🟨 ≥ 50% · 🟥 ≥ 80%. |

### Drop order

On a narrow terminal items disappear in this order, lowest first (rank 1 stays longest):

| Rank | Item | Priority |
|---|---|---|
| 1 | Cache timer (and the cold indicator) | 90 |
| 2 | `⚡` next-request cost | 80 |
| 3 | `⟲` restart thresholds | 70 |
| 4 | Context bar | 60 |
| 5 | `Σ` session cost | 50 |
| 6 | Cost multiplier (`x1.7`) | 40 |
| 7 | `⇲` compaction cost | 30 |
| 8 | Effort level | 20 |
| 9 | Model name | 10 |

Rate-limit windows rank by use: 70 at 80% or more, 30 at 50% or more, 10 below. The order is strict (a dropped item takes everything below it with it). Run with `STATUSLINE_DUMP=/path` to see the width, how many items were dropped and a `priorities:` line listing every item with its priority and a `(dropped)` marker.

Width is detected from the terminal (`stty`), so the line refits on the next refresh after a resize. Claude Code does not re-run the status line on resize, so set `refreshInterval` in `~/.claude/settings.json` (this repo's installer uses 15 s; 3 s feels immediate).

---

### Behaviour

**Smart shrinking:** on a narrow terminal, items (not whole sections) drop one at a time, lowest priority first, until the line fits. The order is strict: once an item is dropped, everything ranked below it is dropped too. See [Drop order](#drop-order).

**Groups:** items are grouped with ` | ` between groups (customizable: `config separator ·`) and a single space inside a group: model · context · session efficiency · cache · each rate-limit window (its own group) and other extras. Fewer groups means fewer delimiters, so more room for data.

**Auto price refresh:** model prices are fetched from Anthropic's public pricing page and cached in `~/.claude/model-prices.json` (re-fetched every hour by default).

---

## Agents

The binary auto-detects which coding agent is feeding it data and adapts the output. Three agents are supported:

| Agent | Status | How it works | Install |
|---|---|---|---|
| **Claude Code** | ✅ Built-in | External command: Claude Code pipes JSON to stdin, the binary returns an ANSI string. Configured via `settings.json` `statusLine.command`. | [Quickstart](#claude-code--plugin-marketplace-recommended) |
| **Cursor** | ✅ Built-in | Same external-command contract, with Cursor-specific fields (`render_width_chars`, `autorun`, `max_mode`, `param_summary`). | [One-shot script](#cursor), then add the JSON snippet to Cursor's settings |
| **OpenCode** | ✅ Plugin (`@statusline/opencode-plugin`) | OpenCode v2 has no external-command contract; it loads in-process TUI plugins that claim a footer slot. TUI mode only — not ACP. | `opencode plugin add @statusline/opencode-plugin` |

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

**Claude Code** — one command copies the binary and wires up `~/.claude/settings.json`:

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

Then add to your Cursor `settings.json` (paths in [Cursor](#cursor) above):

```json
{
  "statusLine": {
    "type": "command",
    "command": "/home/you/.claude/statusline/statusline"
  }
}
```

Use an absolute path; `~` is not expanded in all hosts.

**OpenCode (TUI)** — `opencode plugin add @statusline/opencode-plugin`, as in the [Quickstart](#opencode-tui).

### Updating

| Installed via | Update |
|---|---|
| Claude Code marketplace | `/plugin marketplace update claude-code-status-line`, then `/reload-plugins`. The SessionStart hook rebuilds the binary on the next session. |
| npm | `npx @statusline/claude-plugin@latest install --configure` |
| One-shot script / manual clone | `cd ~/.claude/claude-code-status-line && git pull && npm install` (Cursor: re-copy `bin/statusline` to `~/.claude/statusline/`) |
| OpenCode | `opencode plugin add @statusline/opencode-plugin` again, or pin a version in `opencode.json` |

Your settings live in `~/.claude/statusline/config`, which no update touches.

### Uninstalling

Disabling or uninstalling the Claude Code plugin does **not** stop the status line: it runs from the `statusLine` entry in your own `settings.json` and a copied binary. Undo those first:

- **Claude Code:** `/statusline:uninstall` (or `~/.claude/statusline/statusline uninstall`) removes the `statusLine` entry and the copied binary, and keeps your saved settings; add `--purge` to delete those too. Then, if you used the marketplace: `/plugin uninstall statusline@claude-code-status-line` and `/plugin marketplace remove claude-code-status-line`. Optionally delete `~/.claude/model-prices.json`.
- **Cursor:** remove the `statusLine` entry from Cursor's `settings.json`; delete `~/.claude/statusline/`.
- **OpenCode:** remove `@statusline/opencode-plugin` from `~/.config/opencode/opencode.json`.

---

## Configuration

Three layers, in priority order: **env var** > **config file** > **defaults**.

### Setup wizard

```bash
statusline config wizard
```

A short guided setup, agent-agnostic: each adapter supplies its own sample session for the previews and, where it can, a way to measure the baseline (`--agent claude-code|cursor`, otherwise the installed agent is detected and you choose if there are several). It first **measures** what it can: for Claude Code, the median starting context of your recent sessions (read from the transcripts under `~/.claude/projects`), which sets the baseline used by `⇲` and `⟲` instead of the 25,000-token guess; agents with no usable history keep the default. It also measures how many terminal cells `⚡` takes (saved as `EMOJI_WIDTH` when it is 1) and asks whether the symbols display correctly (answering no selects the `ascii` style). Then it asks about taste: a preset (balanced, minimal, cost-watcher, everything, cryptic), a text style with a preview at 150, 110 and 80 columns, and the base model for the multiplier. It shows the final line and asks before saving. It does not touch Claude Code's `settings.json`.

Scripted use: `statusline config wizard --yes --preset cost-watcher --format glyph [--fresh 29000] [--agent NAME] [--no-calibrate]`. Without `--yes` it needs a terminal. The summary-size estimate (`SUMMARY_TOKENS`) is not measured and stays at its default.

### CLI

`statusline` below is the installed binary (`~/.claude/statusline/statusline`, or `bin/statusline` in a clone). It is not on your `PATH` by default; add an alias or call it by full path.

```bash
statusline config show                        # see current settings + their source
statusline config model "Claude Opus 5.5"     # base model for price multiplier
statusline config sections show stats         # always show cache hit rate
statusline config sections only model context cost  # minimal line
statusline config resets 5h,7d,spend          # which reset windows to show
statusline config thresholds context 60 85    # yellow at 60%, red at 85%
statusline config width 100                   # or: auto
statusline config margin 2                    # right-edge padding
statusline config separator ·                 # between groups: | (default), ·, •, ‖ ... or "space"
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
| `STATUSLINE_EMOJI_WIDTH` | Cells drawn for `⚡` (1 or 2, default 2); the wizard measures it |
| `STATUSLINE_FORMAT` | Text style: `auto` (default), `words`, `short`, `glyph` or `ascii` — see [Text styles](#text-styles-words-short-glyph) |
| `STATUSLINE_SEPARATOR` | Text between groups: 1-3 visible characters (default `\|`), or `space` |
| `STATUSLINE_FORMATS` | Per-section or per-item overrides, e.g. `overhead=glyph,cost.session=words` |
| `STATUSLINE_DUMP` | Same as `config dump PATH` |
| `CLAUDE_CONFIG_DIR` | Config directory (default `~/.claude`) |

### Sections reference

| Name | Default | Shows |
|---|---|---|
| `model` | on | Model name, price multiplier, effort level |
| `context` | on | Context bar + % + window size |
| `overhead` | on | `⚡` next-request cost, `⇲` compaction cost, `⟲` restart thresholds, cold-cache cost |
| `cost` | on | `Σ` session cost |
| `cache` | on | Prompt-cache timer + (optionally) hit rate |
| `stats` | off | Always show cache hit rate (default: only when < 80%) |
| `tokens` | off | Total session tokens (mirrors context %) |
| `resets` | on | Rate-limit reset windows |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Status line doesn't appear | Restart Claude Code. Check `~/.claude/settings.json` has a `statusLine` entry and that its `command` file exists and is executable. Re-run the installer with `--force`: `~/.claude/statusline/statusline install --configure --force` (or `npx @statusline/claude-plugin install --configure --force`). |
| Line is blank or shows an error | Run the [verify command](#check-it-works) by hand; it prints the error. `statusline config dump /tmp/sl.txt` shows the raw JSON your agent sends. |
| `statusLine already set to: …` | Another status line is configured. Re-run the installer with `--force` to replace it. |
| `npm install` of the plugin fails | Use `@statusline/claude-plugin` 1.1.4 or newer; 1.1.3 shipped without its postinstall script. |
| `node: ERR_MODULE_NOT_FOUND` | You ran `node dist/index.js` directly — the unbundled dist can't resolve workspace deps. Use the bundled `bin/statusline` instead, or run via `npm run dev` / `tsx src/index.ts`. |
| Reset windows are missing | They exist on subscription accounts only (enterprise / API-key sessions get no `rate_limits` from Claude Code). Run `statusline config dump /tmp/sl.txt` to see what your account sends. |
| Line never shrinks on narrow terminals | Width couldn't be read from the tty (the fallback walks up to the parent process's tty and runs `stty -F`, or `stty -f` on macOS/BSD). Set it manually: `statusline config width 100`. |
| Multiplier, `⚡`, `⇲` or `⟲` missing | The model has no entry in `~/.claude/model-prices.json`, or the multiplier is 1 (the model is your base model). `⟲` also hides when restarting would not pay back within 99 calls. |
| Price multiplier says `x2.0` unexpectedly | It's relative to your base model (default Sonnet 5.5). Change it: `statusline config model "Claude Opus 5.5"`. |
| A setting seems ignored | An env var `STATUSLINE_<KEY>` beats the saved value. `statusline config show` lists each value and its source. |
| `⏱ cold` never turns into a countdown | The prompt cache has expired or hasn't been written yet; it recovers after the next request. |
| OpenCode plugin doesn't load | It only works in **TUI mode** (`opencode`), not ACP mode (`opencode acp`). See [`packages/opencode-plugin/README.md`](packages/opencode-plugin/README.md). |
| OpenCode line touches or repeats OpenCode's own footer | Use 1.1.2 or newer of `@statusline/opencode-plugin`, or give the line its own row with `"placement": "composer-top"` — see [OpenCode options](#opencode-options). |

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
commands/                Claude Code slash commands (/statusline:setup, /statusline:config)
hooks/                   Claude Code SessionStart hook (builds the binary)
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
npm test
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

- **Remove `formatter.legacy.ts`:** delete the legacy formatter and the fallback path once the new pipeline has proved stable.
- **Type safety:** replace `any` in `adaptInputForCore()` / `RenderContext.input` with a typed `CoreRenderInput`.
- **CI hardening:** make `npm run lint` a required gate (it is `continue-on-error` in `.github/workflows/ci.yml` until the ESLint config is finished).
- **Test isolation:** the integration tests read your real `~/.claude/statusline/config`, so a custom `SEPARATOR` or `FORMAT` makes `end-to-end.test.ts` fail locally. Point them at a temporary `CLAUDE_CONFIG_DIR`.
- **New renderer:** VS Code / Neovim renderers exist in `@statusline/core` but have no integration tests.

### Commit style and releases

Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`). They are not just style: releases are automated from them. A `feat:` or `fix:` that changes files in a package opens a Release PR for that package (`@statusline/core`, `@statusline/opencode-plugin`, or the root `@statusline/claude-plugin`); `docs:`, `test:` and `chore:` do not. Never bump versions by hand. See [`docs/releasing.md`](docs/releasing.md). Keep commits focused, and prefer squash-merging so one change produces one changelog entry.

### Pull requests

- One concern per PR. Large multi-phase refactors should be split.
- Include tests for new behavior. New adapters need fixtures.
- Update docs (`docs/`, `README.md`) if you change user-facing behavior.
- `npm test` must pass. `npm run build` must succeed.

### License

MIT — see [LICENSE](LICENSE).

---

## Credits

Authored by [sergemso](https://github.com/sergemso). TypeScript rewrite and multi-agent architecture built on the section-priority rendering pipeline from `@statusline/core`.
