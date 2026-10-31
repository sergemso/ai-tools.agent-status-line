# Agent Setup Guide

This guide covers installing and configuring the status-line plugin for each supported agent.

## Claude Code

### Installation

Easiest: the plugin marketplace (`/plugin marketplace add sergemso/claude-code-status-line`, `/plugin install statusline@claude-code-status-line`, `/statusline:setup`) or `npx @statusline/claude-plugin install --configure`. See the [README Quickstart](../README.md#quickstart).

By hand, from a built clone — `install --configure` copies the binary and **merges** a `statusLine` entry into `~/.claude/settings.json`, keeping your other settings:

```bash
./bin/statusline install --configure          # add --force to replace a different statusLine
```

To undo it: `~/.claude/statusline/statusline uninstall` (add `--purge` to delete your saved settings too).

Do not overwrite `settings.json` wholesale; it also holds your permissions, plugins and other settings. If you edit it yourself, use an absolute path for the command (`~` is not expanded everywhere).

### Configuration Options

All settings can be configured via `settings.json` or environment variables:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/home/you/.claude/statusline/statusline",
    "refreshInterval": 15
  }
}
```

Environment variables (prefix with `STATUSLINE_`):
- `BASE_MODEL` - Base model for price multiplier
- `SECTIONS` - Enabled sections (comma-separated)
- `RESETS` - Rate limit windows to show
- `CONTEXT_WARN`, `CONTEXT_CRIT` - Context usage thresholds (%)
- `CACHE_WARN`, `CACHE_CRIT` - Cache time thresholds (minutes)
- `RESET_WARN`, `RESET_CRIT` - Rate limit thresholds (%)
- `WIDTH`, `MARGIN` - Terminal width and margin
- `FRESH_TOKENS`, `SUMMARY_TOKENS` - Overhead calculation parameters
- `OVERHEAD_WARN`, `OVERHEAD_CRIT` - Overhead cost thresholds (cents)
- `DUMP` - Debug dump path
- `PRICES_TTL` - Price cache TTL (seconds)

## Cursor

### Installation

```bash
# Copy the binary to your Cursor statusline directory
mkdir -p ~/.cursor/statusline
cp bin/statusline ~/.cursor/statusline/

# Configure cli-config.json
cat > ~/.cursor/cli-config.json << 'EOF'
{
  "statusLine": {
    "type": "command",
    "command": "~/.cursor/statusline/statusline",
    "padding": 2,
    "updateIntervalMs": 300,
    "timeoutMs": 2000
  }
}
EOF
```

### Configuration Options

Cursor provides `render_width_chars` in the input, so terminal width detection is automatic. You can still override via environment variables:

```bash
STATUSLINE_SECTIONS=model,context,tokens
STATUSLINE_WIDTH=120
```

### Cursor-Specific Features

- **Model parameter summary**: Shows `(Thinking)` or similar indicators
- **Max mode**: Indicates when Cursor is in max mode
- **Auto-run**: Shows whether auto-run is enabled
- **Terminal width**: Uses Cursor's `render_width_chars` for perfect fitting

## Verifying Installation

Test the status line with a sample input:

```bash
# Test with Claude Code fixture
cat test/fixtures/claude-code/basic.json | ~/.claude/statusline/statusline statusline

# Test with Cursor fixture
cat test/fixtures/cursor/basic.json | ~/.cursor/statusline/statusline statusline
```

## Troubleshooting

### Status line doesn't appear
- Check the command path in settings is correct
- Verify the binary is executable: `chmod +x ~/.claude/statusline/statusline`
- Check Claude Code/Cursor logs for errors

### Wrong agent detected
- The plugin auto-detects from input JSON structure
- Force agent with `STATUSLINE_AGENT=claude-code` or `STATUSLINE_AGENT=cursor`

### Sections not showing
- Check `SECTIONS` setting includes the section name
- Some sections require specific data (e.g., `cost` needs cost data, `cache` needs cache data)

### Debug mode
Enable debug output:
```bash
STATUSLINE_DUMP=/tmp/statusline-debug.json ~/.claude/statusline/statusline statusline
```