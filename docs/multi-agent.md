# Multi-Agent Status Line Support

## Overview

The status-line plugin now supports multiple coding agents through a unified adapter architecture. Currently supported agents:

- **Claude Code** (reference implementation)
- **Cursor** (VS Code fork with similar API)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Agent Input    │────▶│  Adapter         │────▶│  Unified Model   │
│  (JSON)         │     │  (parse, detect) │     │  (internal)      │
└─────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Agent Output   │◀────│  Formatter       │◀────│  Format Options  │
│  (ANSI string)  │     │  (format, compact)│    │  (per-agent)     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

## How It Works

1. **Auto-detection**: The adapter registry automatically detects the agent from the input JSON structure
2. **Parsing**: Each adapter converts agent-specific JSON to a unified internal model
3. **Formatting**: The generalized formatter generates the status line using the unified model
4. **Compaction**: The output is progressively compacted to fit the terminal width

## Supported Agents

### Claude Code
- **Config**: `~/.claude/settings.json`
- **Input**: `hook_event_name: "Status"` with full context, cost, cache, rate limits
- **Features**: All sections supported (model, context, tokens, cost, overhead, cache, stats, resets)

### Cursor
- **Config**: `~/.cursor/cli-config.json`
- **Input**: `render_width_chars`, `autorun`, `model.param_summary`, `model.max_mode`
- **Features**: Model, context, tokens (no cost, cache, or rate limits)

## Configuration

The plugin automatically detects the agent and uses appropriate defaults. You can override settings:

```bash
# Force specific agent (auto-detect if not set)
STATUSLINE_AGENT=cursor statusline

# Configure sections per agent
STATUSLINE_SECTIONS=model,context,tokens,cost,overhead,cache,resets
```

See [Configuration](configuration.md) for all options.

## Adding New Agents

See [Adding Adapters](adding-adapters.md) for instructions on adding support for new agents.

## Unified Model

See [Unified Model](unified-model.md) for the complete field reference.