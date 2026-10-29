#!/usr/bin/env bash
# install-cursor.sh — one-shot installer for Cursor.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-cursor.sh | bash
#
# Cursor uses the same external-command contract as Claude Code, but its
# settings file lives in a different location. This script:
#   1. Installs the plugin (shared with Claude Code)
#   2. Prints the exact JSON snippet to add to Cursor's settings
#
# Cursor settings location varies by OS:
#   macOS:   ~/Library/Application Support/Cursor/User/settings.json
#   Linux:   ~/.config/Cursor/User/settings.json
#   Windows: %APPDATA%\Cursor\User\settings.json

set -euo pipefail

REPO_URL="https://github.com/sergemso/claude-code-status-line.git"
INSTALL_DIR="${STATUSLINE_INSTALL_DIR:-$HOME/.claude/claude-code-status-line}"
BRANCH="${STATUSLINE_BRANCH:-main}"

echo "→ Installing claude-code-status-line for Cursor"

# 1. Clone/update + build (same as Claude Code installer)
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

# Copy the binary to a stable location
DEST_DIR="$HOME/.claude/statusline"
mkdir -p "$DEST_DIR"
cp "$INSTALL_DIR/bin/statusline" "$DEST_DIR/statusline"
chmod +x "$DEST_DIR/statusline"
BINARY_PATH="$DEST_DIR/statusline"

echo ""
echo "✓ Binary installed at: $BINARY_PATH"
echo ""
echo "→ Add this to your Cursor settings.json:"
echo ""
echo '  {'
echo '    "statusLine": {'
echo "      \"type\": \"command\","
echo "      \"command\": \"$BINARY_PATH\""
echo '    }'
echo '  }'
echo ""
echo "Cursor settings.json location:"
echo "  macOS:  ~/Library/Application Support/Cursor/User/settings.json"
echo "  Linux:  ~/.config/Cursor/User/settings.json"
echo ""
echo "After saving, restart Cursor. The status line will appear in the footer."
