# Agent status line

A rich, single-line status bar for **Claude Code**, **Cursor**, and **OpenCode** — model and price multiplier, context usage, session cost, prompt-cache timer, rate-limit resets. Self-shrinking on narrow terminals. TypeScript, no third-party runtime dependencies.

```text
Sonnet 5.5 hi | ▕▄▏ 42%/200k | Σ $5.6 ⚡ 3.6¢ ⇲ 25¢ ⟲ 7 9 | ⏱ 25m | 12% 4h59m/5h | 55% 6d23h/7d
```

- **Claude Code:** `/plugin marketplace add sergemso/ai-tools.agent-status-line`, then `/plugin install statusline@claude-code-status-line`, then `/statusline:setup`
- **Cursor:** `npx @statusline/claude-plugin install`, then paste the printed `statusLine` snippet into `~/.cursor/cli-config.json` (Cursor Agent CLI; [desktop app](docs/cursor.md#install))
- **OpenCode:** `opencode plugin add @statusline/opencode-plugin`

![The same Claude Code session at 130, 100, 70 and 45 columns](docs/images/claude-code-widths.svg)

*The same session as the terminal narrows. These images are real output of the built binary, not screenshots of the agents.*

**Jump to your agent:** [Claude Code](#claude-code--plugin-marketplace-recommended) ([guide](docs/claude-code.md)) · [Cursor](#cursor) ([guide](docs/cursor.md)) · [OpenCode](#opencode-tui) ([guide](docs/opencode.md))

[Quickstart](#quickstart) · [In 30 seconds](#in-30-seconds) · [Reading the line](#reading-the-line) · [Agents](#agents) · [Updating and uninstalling](#updating-and-uninstalling) · [Configuration](#configuration) · [Troubleshooting](#troubleshooting) · [Contributing](#contributing)

---

## Quickstart

**Requirements:** Node.js ≥ 18. Only the Claude Code one-shot script and installs from a clone need `git` (they build from source); the marketplace, npm and Cursor installs ship a prebuilt binary and need only Node. No `jq`, `curl` or `awk`.

| Agent | Recommended | Alternatives |
|---|---|---|
| **Claude Code** | [Plugin marketplace](#claude-code--plugin-marketplace-recommended): auto-updates, slash commands | [npm](#claude-code--npm-pinned-no-auto-update) · [one-shot script](#claude-code--one-shot-script) · [from a clone](docs/claude-code.md#install) |
| **Cursor** | [`npx @statusline/claude-plugin install`](#cursor) | [from a clone](docs/cursor.md#install) |
| **OpenCode** (TUI) | `opencode plugin add @statusline/opencode-plugin` ([details](#opencode-tui)) | [one-shot script](#opencode-tui) |

**Names, because there are three:** the GitHub repo is `ai-tools.agent-status-line` and the Claude Code marketplace is `claude-code-status-line`; the npm packages are `@statusline/claude-plugin` (the CLI and Claude Code/Cursor binary), `@statusline/core` (the library) and `@statusline/opencode-plugin`; the Claude Code plugin itself is called `statusline`.

Full guides with screenshots, options and troubleshooting: **[Claude Code](docs/claude-code.md) · [Cursor](docs/cursor.md) · [OpenCode](docs/opencode.md)**.

### Claude Code — plugin marketplace (recommended)

```
/plugin marketplace add sergemso/ai-tools.agent-status-line
/plugin install statusline@claude-code-status-line
/statusline:setup
```

`/statusline:setup` copies the prebuilt binary to `~/.claude/statusline/statusline` and writes the `statusLine` entry into `~/.claude/settings.json` (it refuses to overwrite a different status line unless you add `--force`). It then offers to walk you through customising. (`/statusline:uninstall` undoes it.) A SessionStart hook (`scripts/bootstrap.sh`) re-copies the binary when the plugin updates. **Restart Claude Code** after the first install.

### Claude Code — npm (pinned, no auto-update)

```bash
npx @statusline/claude-plugin install --configure
```

This does the same copy-and-configure step as `/statusline:setup` from the published, prebuilt package: no git, no build. There is no auto-update and no slash commands; to update, run the same command again (add `@<version>` to pin one). Restart Claude Code afterwards. To keep the package itself around instead of using `npx`: `npm install --prefix ~/.claude/statusline/npm @statusline/claude-plugin`, then run `~/.claude/statusline/npm/node_modules/.bin/statusline install --configure`.

### Claude Code — one-shot script

```bash
curl -fsSL https://raw.githubusercontent.com/sergemso/ai-tools.agent-status-line/main/scripts/install-claude-code.sh | bash
```

Clones the repo to `~/.claude/claude-code-status-line`, builds it and runs `install --configure`. Updating means `git pull && npm install` in that directory.

### Check it works

After restarting your agent the line appears at the bottom of the prompt. To test the binary on its own, feed it a minimal Claude Code payload (`session_id`, `model`, `cost` and `context_window` are required):

```bash
echo '{"session_id":"test","model":{"id":"claude-sonnet-5-5","display_name":"Sonnet 5.5"},"cost":{"total_cost_usd":0.5},"context_window":{"context_window_size":200000,"used_percentage":12}}' \
  | ~/.claude/statusline/statusline
```

You should see something like `Sonnet 5.5 | ▕▁▏ 12%/200k | Σ 50¢`. Then run `~/.claude/statusline/statusline config show` to see your settings and where each comes from. Nothing showing? See [Troubleshooting](#troubleshooting).

### Make it yours

- `/statusline:config` inside Claude Code (guided), or
- `~/.claude/statusline/statusline config wizard` in a terminal: measures your real starting context, previews text styles at several widths, asks about base model and preset. See [Configuration](#configuration).

New to the symbols? Read [In 30 seconds](#in-30-seconds) next.

### Cursor

```bash
npx @statusline/claude-plugin install
```

This only copies the prebuilt binary to `~/.claude/statusline/` (no git, no build) and prints a `statusLine` JSON snippet; **you still paste the snippet yourself**. For the Cursor Agent CLI, paste it into `~/.cursor/cli-config.json` (verified). For the desktop app the file is probably Cursor's `settings.json`, but that is unverified: see [Where the entry goes](docs/cursor.md#install). Restart Cursor after. Cursor has no public plugin registry for status lines, so there is no marketplace route. (`curl -fsSL https://raw.githubusercontent.com/sergemso/ai-tools.agent-status-line/main/scripts/install-cursor.sh | bash` does the same and also prints the settings locations.)

### OpenCode (TUI)

```bash
opencode plugin add @statusline/opencode-plugin
```

That adds the package to `~/.config/opencode/opencode.json`; run `opencode` and the line appears in the footer. The one-shot script (`scripts/install-opencode.sh`) does the same. **TUI mode only**: `opencode acp` has no footer to draw into.

#### OpenCode options

Options go in `~/.config/opencode/cli.json`, not `opencode.json` (options in `opencode.json` are ignored). OpenCode shows its own context, cost and `ctrl+p commands` on the right of the footer, so by default the line renders only `model,tokens,resets` there and leaves a two-column gap. To change that, register the plugin in `cli.json` with options:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    {
      "package": "@statusline/opencode-plugin",
      "options": { "placement": "composer-top", "sections": "model,context,cost,tokens,resets" }
    }
  ]
}
```

`placement`: `replace` (default; takes over the footer status slot), `append` (adds to it) or `composer-top` (its own full-width row above the prompt; needs a release newer than 1.1.2, the next release). `sections` is a comma-separated list of `model`, `context`, `cost`, `tokens`, `resets`, `worktree`, … Full reference: [`packages/opencode-plugin/README.md`](packages/opencode-plugin/README.md).

Rate-limit reset windows are only supported for the `zai` and `zai-cn` providers; other providers show none (see [Quota windows](docs/opencode.md#quota-windows)).

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

Each group below explains one part of the line. The image shows one Claude Code session at a fixed 130 columns in six states, each captioned in the image: fresh session, mid session (next-call cost and restart thresholds appear), cold cache, context nearly full, rate limit close, and a pricier model. It uses the words and short forms; the tables below show the glyph form, which is what you get on a narrower window (see [Text styles](#text-styles-and-behaviour)).

![Six states of the Claude Code status line](docs/images/claude-code-states.svg)

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
| `▕▂▏ 18%/1M` | Context window use: bar, percent used, window size. 🟩 < 50% · 🟨 ≥ 50% · 🟥 ≥ 80%. |

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

### Text styles and behaviour

Each item has three text forms: **words** (`session 31¢`), **short** (`31¢ total`) and **glyph** (`Σ 31¢`), plus a plain-**ascii** fallback. By default the line uses the most readable form that fits and falls towards glyphs as the window narrows; items drop only after glyphs no longer fit. Force one with `statusline config format glyph`.

Details, the full table and per-item overrides: [docs/text-styles.md](docs/text-styles.md). The examples in this README use the glyph form.

---

## Agents

The binary auto-detects which coding agent is feeding it data and adapts the output. Three agents are supported:

| Agent | Status | How it works | Install |
|---|---|---|---|
| **Claude Code** | ✅ Built-in | External command: Claude Code pipes JSON to stdin, the binary returns an ANSI string. Configured via `settings.json` `statusLine.command`. | [Quickstart](#claude-code--plugin-marketplace-recommended) · [guide](docs/claude-code.md) |
| **Cursor** | ✅ Built-in | Same external-command contract, with Cursor-specific fields (`render_width_chars`, `autorun`, `max_mode`, `param_summary`). | [`npx` install](#cursor), then add the JSON snippet to Cursor's settings · [guide](docs/cursor.md) |
| **OpenCode** | ✅ Plugin (`@statusline/opencode-plugin`) | OpenCode v2 has no external-command contract; it loads in-process TUI plugins that claim a footer slot. TUI mode only — not ACP. | `opencode plugin add @statusline/opencode-plugin` · [guide](docs/opencode.md) |

**Add a new agent:** implement the `StatusLineAdapter` interface (see [`docs/adding-adapters.md`](docs/adding-adapters.md)). Detection is automatic via `canHandle()`.

Check what's registered:

```bash
statusline agent list
statusline agent detect path/to/input.json
```

### Updating and uninstalling

Per-agent steps are in each guide: [Claude Code](docs/claude-code.md#updating) · [Cursor](docs/cursor.md#configure-update-remove) · [OpenCode](docs/opencode.md#update-and-remove). In short:

| Agent | Update | Uninstall |
|---|---|---|
| Claude Code | Marketplace: `/plugin marketplace update claude-code-status-line`, then `/reload-plugins`. npm: `npx @statusline/claude-plugin@latest install --configure`. Script or clone: `git pull && npm install`. | `/statusline:uninstall` **first** (disabling the plugin does not stop the status line), then `/plugin uninstall statusline@claude-code-status-line`. |
| Cursor | `npx @statusline/claude-plugin@latest install` again. | Remove the `statusLine` entry from Cursor's settings; delete `~/.claude/statusline/`. |
| OpenCode | `opencode plugin add @statusline/opencode-plugin` again, or pin a version in `opencode.json`. | Remove `@statusline/opencode-plugin` from `~/.config/opencode/opencode.json`. |

Your settings live in `~/.claude/statusline/config`; updates never touch them.

---

## Configuration

Three layers, in priority order: **env var** > **config file** > **defaults**. Start with `/statusline:config` (Claude Code) or `statusline config wizard` (any terminal), and run `statusline config show` to see every value and where it comes from.

The wizard, every CLI command, all `STATUSLINE_*` environment variables and the sections reference are in **[docs/configuration.md](docs/configuration.md)**.

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
| OpenCode line touches or repeats OpenCode's own footer | Use 1.1.2 or newer of `@statusline/opencode-plugin`. To give the line its own row, `"placement": "composer-top"` needs a release newer than 1.1.2 (the next release); on 1.1.2 it draws nothing. See [OpenCode options](#opencode-options). |

---

## Contributing

Bug reports, fixtures, new adapters, renderer improvements and docs are welcome. Setup, common tasks, commit style, pull requests and good first issues are in **[CONTRIBUTING.md](CONTRIBUTING.md)**; how the code is organised is in **[docs/architecture.md](docs/architecture.md)**.

## License

MIT — see [LICENSE](LICENSE).


## Credits

Authored by [sergemso](https://github.com/sergemso). TypeScript rewrite and multi-agent architecture built on the section-priority rendering pipeline from `@statusline/core`.
