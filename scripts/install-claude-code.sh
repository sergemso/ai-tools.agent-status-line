#!/usr/bin/env bash
# install-claude-code.sh — one-shot installer for Claude Code.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sergemso/claude-code-status-line/main/scripts/install-claude-code.sh | bash
#
# Or, if you've cloned the repo:
#   bash scripts/install-claude-code.sh
#
# What it does:
#   1. Clones the repo to ~/.claude/claude-code-status-line (or updates it)
#   2. Runs npm install (which triggers postinstall → builds the binary)
#   3. Runs `bin/statusline install --configure` to wire up ~/.claude/settings.json
#
# After it finishes, restart Claude Code and you'll see the status line.

set -euo pipefail

REPO_URL="https://github.com/sergemso/claude-code-status-line.git"
INSTALL_DIR="${STATUSLINE_INSTALL_DIR:-$HOME/.claude/claude-code-status-line}"
BRANCH="${STATUSLINE_BRANCH:-main}"

echo "→ Installing claude-code-status-line to $INSTALL_DIR"

# 1. Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  (updating existing clone)"
  cd "$INSTALL_DIR"
  git fetch origin "$BRANCH" --quiet
  git checkout "$BRANCH" --quiet
  git reset --hard "origin/$BRANCH" --quiet
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 2. Install + build (postinstall builds the binary automatically)
echo "→ Installing dependencies and building..."
npm install --silent 2>&1 | tail -3 || {
  echo "✗ npm install failed. Try running it manually in $INSTALL_DIR"
  exit 1
}

# 3. Configure Claude Code
echo "→ Configuring Claude Code settings..."
if [ "$#" -gt 0 ]; then
  ./bin/statusline install --configure "$@"
else
  ./bin/statusline install --configure
fi

echo ""
echo "✓ Done. Restart Claude Code to see the status line."
echo "  Install dir: $INSTALL_DIR"
echo "  Configure:   $INSTALL_DIR/bin/statusline config show"
echo "  Update:      cd $INSTALL_DIR && git pull && npm install"
