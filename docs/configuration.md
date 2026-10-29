# Configuration Reference

## Settings File Locations

| Agent | Config File | Settings Key |
|-------|-------------|--------------|
| Claude Code | `~/.claude/settings.json` | `statusLine` |
| Cursor | `~/.cursor/cli-config.json` | `statusLine` |

## Configuration Methods (Priority Order)

1. **Environment variables** (highest priority) - `STATUSLINE_<SETTING>`
2. **Config file** - Agent-specific settings file
3. **Defaults** (lowest priority)

## Settings Reference

### Core Settings

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `BASE_MODEL` | `STATUSLINE_BASE_MODEL` | `Claude Sonnet 5.5` | Base model for price multiplier |
| `SECTIONS` | `STATUSLINE_SECTIONS` | Auto per agent | Enabled sections (comma-separated) |
| `RESETS` | `STATUSLINE_RESETS` | `5h,7d,spend` | Rate limit windows to show |
| `WIDTH` | `STATUSLINE_WIDTH` | `0` (auto) | Terminal width (0 = auto-detect) |
| `MARGIN` | `STATUSLINE_MARGIN` | `2` | Right margin in columns |
| `DUMP` | `STATUSLINE_DUMP` | (empty) | Debug dump file path |
| `PRICES_TTL` | `STATUSLINE_PRICES_TTL` | `3600` | Price cache TTL (seconds) |

### Section Names

| Section | Description | Requires Data |
|---------|-------------|---------------|
| `model` | Model name and effort level | Always |
| `context` | Context usage bar | Context window |
| `tokens` | Session token count | Token usage |
| `cost` | Session cost | Cost tracking |
| `overhead` | Overhead cost of continuing | Cache + pricing |
| `cache` | Prompt cache status | Cache info |
| `stats` | Cache hit rate | Cache hit ratio |
| `resets` | Rate limit windows | Rate limits |

### Threshold Settings

| Setting | Env Var | Default | Unit | Description |
|---------|---------|---------|------|-------------|
| `CONTEXT_WARN` | `STATUSLINE_CONTEXT_WARN` | `50` | % | Yellow threshold for context usage |
| `CONTEXT_CRIT` | `STATUSLINE_CONTEXT_CRIT` | `80` | % | Red threshold for context usage |
| `CACHE_WARN` | `STATUSLINE_CACHE_WARN` | `20` | min | Yellow when cache expires in N minutes |
| `CACHE_CRIT` | `STATUSLINE_CACHE_CRIT` | `5` | min | Red when cache expires in N minutes |
| `RESET_WARN` | `STATUSLINE_RESET_WARN` | `50` | % | Yellow threshold for rate limits |
| `RESET_CRIT` | `STATUSLINE_RESET_CRIT` | `80` | % | Red threshold for rate limits |
| `OVERHEAD_WARN` | `STATUSLINE_OVERHEAD_WARN` | `5` | ¢ | Yellow threshold for overhead cost |
| `OVERHEAD_CRIT` | `STATUSLINE_OVERHEAD_CRIT` | `20` | ¢ | Red threshold for overhead cost |

### Overhead Settings

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `FRESH_TOKENS` | `STATUSLINE_FRESH_TOKENS` | `25000` | Tokens considered "fresh" (no overhead) |
| `SUMMARY_TOKENS` | `STATUSLINE_SUMMARY_TOKENS` | `8000` | Tokens in compaction summary |

## Agent-Specific Defaults

### Claude Code (Default)
```json
{
  "SECTIONS": "model,context,cost,overhead,cache,resets",
  "RESETS": "5h,7d,spend"
}
```

### Cursor (Default)
```json
{
  "SECTIONS": "model,context,tokens",
  "RESETS": "none"
}
```

## Configuration Commands

```bash
# Show current settings
statusline config show

# Set base model
statusline config model "Claude Sonnet 5.5"
statusline config model list

# Manage sections
statusline config sections show context tokens
statusline config sections hide cost
statusline config sections only model context
statusline config sections all

# Manage rate limit windows
statusline config resets 5h,7d,spend

# Set thresholds
statusline config thresholds context 50 80
statusline config thresholds cache 20 5
statusline config thresholds resets 50 80
statusline config thresholds overhead 5 20

# Set terminal width
statusline config width 120
statusline config width auto

# Set margin
statusline config margin 2

# Set overhead parameters
statusline config overhead 25000 8000

# Set dump path
statusline config dump /tmp/debug.json
statusline config dump off

# Reset settings
statusline config reset
statusline config reset SECTIONS RESETS
```

## Environment Variable Examples

```bash
# Minimal config for Cursor
STATUSLINE_SECTIONS=model,context,tokens
STATUSLINE_WIDTH=120

# Full config for Claude Code
STATUSLINE_BASE_MODEL="Claude Sonnet 5.5"
STATUSLINE_SECTIONS=model,context,tokens,cost,overhead,cache,resets
STATUSLINE_RESETS=5h,7d,spend
STATUSLINE_CONTEXT_WARN=50
STATUSLINE_CONTEXT_CRIT=80
STATUSLINE_CACHE_WARN=20
STATUSLINE_CACHE_CRIT=5
STATUSLINE_RESET_WARN=50
STATUSLINE_RESET_CRIT=80
STATUSLINE_OVERHEAD_WARN=5
STATUSLINE_OVERHEAD_CRIT=20
STATUSLINE_WIDTH=0
STATUSLINE_MARGIN=2
STATUSLINE_FRESH_TOKENS=25000
STATUSLINE_SUMMARY_TOKENS=8000
STATUSLINE_DUMP=/tmp/statusline-debug.json
STATUSLINE_PRICES_TTL=3600
```

## Debug Dump Format

When `DUMP` is set, each run appends:
```
<raw JSON input>
cols=<terminal width> margin=<margin> level=<compaction level> visible=<visible width>
```

This helps debug compaction and width issues.