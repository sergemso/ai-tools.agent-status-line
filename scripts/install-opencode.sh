#!/usr/bin/env bash
# install-opencode.sh — one-shot installer for OpenCode (TUI mode).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-opencode.sh | bash
#
# Two install paths, depending on whether @statusline/opencode-plugin is
# published to npm:
#
#   A. npm install (preferred, when published):
#        opencode reads "plugins": ["@statusline/opencode-plugin"] from
#        opencode.json and auto-installs the package via Bun at startup.
#
#   B. Local build (fallback, when not yet published):
#        Clone the repo, build the plugin, point opencode.json at the
#        built dist/index.js.
#
# This script tries path A first; if the package isn't on npm, falls back
# to path B and prints the local path to add to opencode.json.
#
# IMPORTANT: This only works in OpenCode TUI mode (`opencode`).
# In ACP mode (`opencode acp`) the editor renders its own UI — the
# plugin does not apply.

set -euo pipefail

REPO_URL="https://github.com/sergemso/claude-code-status-line.git"
INSTALL_DIR="${STATUSLINE_INSTALL_DIR:-$HOME/.claude/claude-code-status-line}"
BRANCH="${STATUSLINE_BRANCH:-main}"
OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
PLUGIN_NAME="@statusline/opencode-plugin"

echo "→ Installing $PLUGIN_NAME for OpenCode"

# Try path A: check if the package is on npm
if npm view "$PLUGIN_NAME" version >/dev/null 2>&1; then
  echo "✓ $PLUGIN_NAME is published on npm."
  echo ""
  echo "→ Add this to $OPENCODE_CONFIG_DIR/opencode.json:"
  echo ""
  echo '  {'
  echo '    "$schema": "https://opencode.ai/config.json",'
  echo '    "plugins": ['
  echo "      \"$PLUGIN_NAME\""
  echo '    ]'
  echo '  }'
  echo ""
  echo "OpenCode auto-installs npm plugins via Bun at startup — no manual build needed."
  echo "Run \`opencode\` (TUI mode) and the status line appears in the footer."
  exit 0
fi

# Path B: local build
echo "  (package not on npm yet — falling back to local build)"

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

npm run build:core --silent 2>&1 | tail -2
npm run build --silent 2>&1 | tail -2
npm run build --workspace=@statusline/opencode-plugin --silent 2>&1 | tail -2 || {
  echo "✗ opencode-plugin build failed."
  exit 1
}

PLUGIN_DIST="$INSTALL_DIR/packages/opencode-plugin/dist/index.js"

echo ""
echo "✓ Plugin built at: $PLUGIN_DIST"
echo ""
echo "→ Add this to $OPENCODE_CONFIG_DIR/opencode.json:"
echo ""
echo '  {'
echo '    "$schema": "https://opencode.ai/config.json",'
echo '    "plugins": ['
echo "      \"$PLUGIN_DIST\""
echo '    ]'
echo '  }'
echo ""
echo "Run \`opencode\` (TUI mode) — the status line appears in the footer."
echo ""
echo "Note: This plugin does NOT work in ACP mode (\`opencode acp\`)."
echo "      ACP is a protocol for editors (Zed/JetBrains); the editor renders its own UI."
