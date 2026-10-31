#!/usr/bin/env bash
# install-cursor.sh — one-shot installer for Cursor.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/ai-tools.agent-status-line/main/scripts/install-cursor.sh | bash
#
# Cursor uses the same external-command statusLine contract as Claude Code.
# Cursor's own plugin marketplace is team/enterprise-only (no public registry
# for status-line plugins), so the install path is:
#   1. Run the published @statusline/claude-plugin package (prebuilt, needs only Node)
#   2. It copies the binary to ~/.claude/statusline/
#   3. Print the JSON snippet to add to Cursor's config
#
# Cursor Agent CLI: ~/.cursor/cli-config.json (verified).
# Cursor desktop app settings.json location (not verified):
#   macOS:   ~/Library/Application Support/Cursor/User/settings.json
#   Linux:   ~/.config/Cursor/User/settings.json
#   Windows: %APPDATA%\Cursor\User\settings.json

set -euo pipefail

echo "→ Installing @statusline/claude-plugin for Cursor"

command -v npx >/dev/null 2>&1 || { echo "✗ Node.js >= 18 (with npx) is required."; exit 1; }

# 1-2. Run the prebuilt package; it copies the binary to a stable location.
# (Without --configure it leaves Claude Code's settings.json alone.)
npx --yes @statusline/claude-plugin@latest install >/dev/null || {
  echo "✗ npx @statusline/claude-plugin install failed."
  exit 1
}

DEST_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline"
BINARY_PATH="$DEST_DIR/statusline"
[ -x "$BINARY_PATH" ] || { echo "✗ Expected binary at $BINARY_PATH was not created."; exit 1; }

echo ""
echo "✓ Binary installed at: $BINARY_PATH"
echo ""
echo "→ Add this to the Cursor Agent CLI config, ~/.cursor/cli-config.json:"
echo ""
echo '  {'
echo '    "statusLine": {'
echo "      \"type\": \"command\","
echo "      \"command\": \"$BINARY_PATH\""
echo '    }'
echo '  }'
echo ""
echo "For the Cursor desktop app (not verified) use its settings.json instead:"
echo "  macOS:  ~/Library/Application Support/Cursor/User/settings.json"
echo "  Linux:  ~/.config/Cursor/User/settings.json"
echo ""
echo "After saving, restart Cursor. The status line will appear in the footer."
echo ""
echo "Note: Cursor's plugin marketplace is team/enterprise-only and has no"
echo "      statusLine hook, so there's no marketplace install path — only"
echo "      this script or copying the binary yourself (see docs/cursor.md)."
