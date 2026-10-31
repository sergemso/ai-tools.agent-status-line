#!/usr/bin/env bash
# install-opencode.sh — one-shot installer for OpenCode (TUI mode).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/ai-tools.agent-status-line/main/scripts/install-opencode.sh | bash
#
# Two install paths, depending on whether @statusline/opencode-plugin is
# published to npm:
#
#   A. npm install (preferred, when published):
#        opencode reads "plugins": ["@statusline/opencode-plugin"] from
#        opencode.json and auto-installs the package via Bun at startup.
#
#   B. Local build (fallback, when not yet published):
#        Clone the repo and build the plugin. OpenCode 2.1.4 does not
#        load arbitrary local paths from the plugins array, so the
#        package must still be installed from a registry.
#
# This script tries path A first; if the package isn't on npm, falls back
# to path B and prints how to install the built package.
#
# IMPORTANT: This only works in OpenCode TUI mode (`opencode`).
# In ACP mode (`opencode acp`) the editor renders its own UI — the
# plugin does not apply.

set -euo pipefail

REPO_URL="https://github.com/sergemso/ai-tools.agent-status-line.git"
INSTALL_DIR="${STATUSLINE_INSTALL_DIR:-$HOME/.claude/claude-code-status-line}"
BRANCH="${STATUSLINE_BRANCH:-main}"
OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
PLUGIN_NAME="@statusline/opencode-plugin"

echo "→ Installing $PLUGIN_NAME for OpenCode"

# Try path A: check if the package is on npm
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

PLUGIN_DIR="$INSTALL_DIR/packages/opencode-plugin"

echo ""
echo "✓ Plugin built at: $PLUGIN_DIR"
echo ""
echo "→ Publish the package or install it from a local registry, then run:"
echo ""
echo "    opencode plugin add @statusline/opencode-plugin"
echo ""
echo "OpenCode 2.1.4 does not load arbitrary local paths from the plugins array."
echo ""
echo "Run \`opencode\` (TUI mode) — the status line appears in the footer."
echo ""
echo "Note: This plugin does NOT work in ACP mode (\`opencode acp\`)."
echo "      ACP is a protocol for editors (Zed/JetBrains); the editor renders its own UI."
