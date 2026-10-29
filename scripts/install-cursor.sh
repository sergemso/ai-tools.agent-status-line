#!/usr/bin/env bash
# install-cursor.sh — one-shot installer for Cursor.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-cursor.sh | bash
#
# Cursor uses the same external-command statusLine contract as Claude Code.
# Cursor's own plugin marketplace is team/enterprise-only (no public registry
# for status-line plugins), so the install path is:
#   1. Clone + build the shared binary
#   2. Copy it to a stable location
#   3. Print the JSON snippet to add to Cursor's settings.json
#
# Cursor settings.json location:
#   macOS:   ~/Library/Application Support/Cursor/User/settings.json
#   Linux:   ~/.config/Cursor/User/settings.json
#   Windows: %APPDATA%\Cursor\User\settings.json

set -euo pipefail

REPO_URL="https://github.com/sergemso/claude-code-status-line.git"
INSTALL_DIR="${STATUSLINE_INSTALL_DIR:-$HOME/.claude/claude-code-status-line}"
BRANCH="${STATUSLINE_BRANCH:-main}"

echo "→ Installing claude-code-status-line for Cursor"

# 1. Clone/update + build (shared with Claude Code installer)
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

# 2. Copy the binary to a stable location
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
echo ""
echo "Note: Cursor's plugin marketplace is team/enterprise-only and has no"
echo "      statusLine hook, so there's no marketplace install path — only"
echo "      this script or manual setup (see README.md → Manual setup)."
