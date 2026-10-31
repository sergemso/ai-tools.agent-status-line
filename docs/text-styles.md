# Text styles and behaviour

How the line chooses between words, short forms and glyphs, and how it shrinks. The indicators themselves are explained in [Reading the line](../README.md#reading-the-line); the settings are in [Configuration](configuration.md).

## Text styles: words, short, glyph

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

## Behaviour

**Smart shrinking:** on a narrow terminal, items (not whole sections) drop one at a time, lowest priority first, until the line fits. The order is strict: once an item is dropped, everything ranked below it is dropped too. See [Drop order](../README.md#drop-order).

**Groups:** items are grouped with ` | ` between groups (customizable: `config separator ·`) and a single space inside a group: model · context · session efficiency · cache · each rate-limit window (its own group) and other extras. Fewer groups means fewer delimiters, so more room for data.

**Auto price refresh:** model prices are fetched from Anthropic's public pricing page and cached in `~/.claude/model-prices.json` (re-fetched every hour by default).
