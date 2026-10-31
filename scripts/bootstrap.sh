#!/usr/bin/env bash
# bootstrap.sh — SessionStart hook for Claude Code plugin marketplace.
#
# The marketplace installs the prebuilt npm package, so this hook only copies
# the binary to the stable location settings.json points at (see below).
# When run from a source checkout (no prebuilt package), it instead builds the
# binary in the background; Claude Code does not run `npm install` itself.
#
# It is idempotent and fast: if the binary is already in place and current, it
# exits immediately (< 50ms).
#
# Environment:
#   CLAUDE_PLUGIN_ROOT  — set by Claude Code to the plugin's install dir
#   CLAUDE_CONFIG_DIR   — ~/.claude by default

set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
BINARY="$PLUGIN_ROOT/bin/statusline"
DEST_DIR="$CONFIG_DIR/statusline"
DEST_BINARY="$DEST_DIR/statusline"

# Prebuilt package (installed from npm): there are no sources to build, so
# just keep the copy Claude Code's settings point at in step with the plugin.
if [ ! -f "$PLUGIN_ROOT/src/index.ts" ]; then
  chmod +x "$BINARY" 2>/dev/null || true
  if [ -x "$BINARY" ] && ! cmp -s "$BINARY" "$DEST_BINARY" 2>/dev/null; then
    mkdir -p "$DEST_DIR"
    cp "$BINARY" "$DEST_BINARY" && chmod +x "$DEST_BINARY"
  fi
  exit 0
fi

# Fast path: binary exists, is executable, and is newer than source → bail out.
if [ -x "$BINARY" ] && [ -x "$DEST_BINARY" ] && \
   [ "$BINARY" -nt "$PLUGIN_ROOT/src/index.ts" ]; then
  exit 0
fi

# Slow path: build needed. Run silently, don't pollute the session output.
{
  cd "$PLUGIN_ROOT"

  # Ensure node_modules are installed (marketplace install skips npm install)
  if [ ! -d "node_modules" ]; then
    npm install --silent --no-audit --no-fund >/dev/null 2>&1 || exit 0
  fi

  # Build core + main binary if stale
  if [ ! -x "$BINARY" ] || [ "$BINARY" -ot "$PLUGIN_ROOT/src/index.ts" ]; then
    npm run build:core --silent >/dev/null 2>&1 || exit 0
    npm run build --silent >/dev/null 2>&1 || exit 0
    chmod +x "$BINARY" 2>/dev/null || true
  fi

  # Copy the binary to the stable location Claude Code's settings point at
  if [ -x "$BINARY" ]; then
    mkdir -p "$DEST_DIR"
    cp "$BINARY" "$DEST_BINARY"
    chmod +x "$DEST_BINARY"
  fi
} >/dev/null 2>&1 &

# Don't wait for the build — let the session start immediately.
# The binary will be ready by the next refresh (15s default).
exit 0
