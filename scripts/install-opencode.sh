#!/usr/bin/env bash
# install-opencode.sh — one-shot installer for OpenCode.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-opencode.sh | bash
#
# OpenCode v2 has no external-command status-line contract. Instead it
# loads in-process TUI plugins. This script:
#   1. Clones the repo + builds the @statusline/opencode-plugin package
#   2. Creates a plugin shim in ~/.config/opencode/plugins/statusline/
#   3. Prints the snippet to add to opencode.json
#
# IMPORTANT: This only works in OpenCode TUI mode (`opencode`).
# In ACP mode (`opencode acp`) the editor renders its own UI — the
# plugin does not apply.

set -euo pipefail

REPO_URL="https://github.com/sergemso/claude-code-status-line.git"
INSTALL_DIR="${STATUSLINE_INSTALL_DIR:-$HOME/.claude/claude-code-status-line}"
BRANCH="${STATUSLINE_BRANCH:-main}"
OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"

echo "→ Installing @statusline/opencode-plugin"

# 1. Clone/update + build
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  git fetch origin "$BRANCH" --quiet
  git checkout "$BRANCH" --quiet
  git reset --hard "origin/$BRANCH" --quiet
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo "→ Installing dependencies and building..."
npm install --silent 2>&1 | tail -3 || {
  echo "✗ npm install failed."
  exit 1
}

# Build core + opencode plugin
npm run build:core --silent 2>&1 | tail -2
npm run build --silent 2>&1 | tail -2
npm run build --workspace=@statusline/opencode-plugin --silent 2>&1 | tail -2 || {
  echo "✗ opencode-plugin build failed."
  exit 1
}

PLUGIN_DIR="$INSTALL_DIR/packages/opencode-plugin"

echo ""
echo "✓ Plugin built at: $PLUGIN_DIR/dist/"
echo ""
echo "→ Add this to your OpenCode config:"
echo ""
echo "  File: $OPENCODE_CONFIG_DIR/opencode.json"
echo ""
echo '  {'
echo '    "$schema": "https://opencode.ai/config.json",'
echo '    "plugins": ['
echo "      \"$PLUGIN_DIR/dist/index.js\""
echo '    ]'
echo '  }'
echo ""
echo "If the file already exists, just add the plugin path to the \"plugins\" array."
echo ""
echo "After saving, run \`opencode\` (TUI mode). The status line appears in the footer."
echo ""
echo "Note: This plugin does NOT work in ACP mode (\`opencode acp\`)."
echo "      ACP is a protocol for editors (Zed/JetBrains); the editor renders its own UI."
