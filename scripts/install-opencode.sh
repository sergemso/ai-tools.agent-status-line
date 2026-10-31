#!/usr/bin/env bash
# install-opencode.sh — one-shot installer for OpenCode (TUI mode).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/ai-tools.agent-status-line/main/scripts/install-opencode.sh | bash
#
# Installs the published @statusline/opencode-plugin: with `opencode plugin add`
# when the `opencode` CLI is on PATH, otherwise by printing the opencode.json
# entry to add. OpenCode installs npm plugins itself at startup, so there is
# nothing to build. (OpenCode 2.x does not load local paths from the plugins
# array, so there is no build-from-source route.)
#
# IMPORTANT: This only works in OpenCode TUI mode (`opencode`).
# In ACP mode (`opencode acp`) the editor renders its own UI — the
# plugin does not apply.

set -euo pipefail

OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
PLUGIN_NAME="@statusline/opencode-plugin"

echo "→ Installing $PLUGIN_NAME for OpenCode"

# Check the package is on npm
if npm view "$PLUGIN_NAME" version >/dev/null 2>&1; then
  echo "✓ $PLUGIN_NAME is published on npm."
  echo ""
  if command -v opencode >/dev/null 2>&1; then
    echo "→ Installing the plugin..."
    opencode plugin add "$PLUGIN_NAME"
  else
    echo "→ Add this to $OPENCODE_CONFIG_DIR/opencode.json:"
    echo ""
    echo '  {'
    echo '    "$schema": "https://opencode.ai/config.json",'
    echo '    "plugins": ['
    echo "      \"$PLUGIN_NAME\""
    echo '    ]'
    echo '  }'
  fi
  echo ""
  echo "OpenCode auto-installs npm plugins at startup — no manual build needed."
  echo "Run \`opencode\` (TUI mode) and the status line appears in the footer."
  exit 0
fi

echo "✗ Could not find $PLUGIN_NAME on the npm registry (offline, or a registry mirror without it)."
echo "  Check your connection, then re-run this script, or run:  opencode plugin add $PLUGIN_NAME"
exit 1
