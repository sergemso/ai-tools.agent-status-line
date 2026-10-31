#!/usr/bin/env bash
# smoke-pack.sh — install the packed tarballs into an empty directory and use
# them, the way a registry install would. Catches files missing from the
# published packages (e.g. a postinstall script that is not shipped).
#
# Needs the packages built first:
#   npm run build:core && npm run build && npm run build:opencode
#
# Usage: bash scripts/smoke-pack.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "✗ $*" >&2; exit 1; }
ok() { echo "✓ $*"; }

mkdir "$WORK/tarballs" "$WORK/install" "$WORK/config"
cd "$ROOT"
npm pack --silent --pack-destination "$WORK/tarballs" \
  --workspace=@statusline/core \
  --workspace=@statusline/opencode-plugin >/dev/null
npm pack --silent --pack-destination "$WORK/tarballs" >/dev/null
ok "packed $(ls "$WORK/tarballs" | wc -l | tr -d ' ') tarballs"

cd "$WORK/install"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund "$WORK"/tarballs/*.tgz \
  || fail "npm install of the packed tarballs failed"
ok "installed into a clean directory"

PKG="$WORK/install/node_modules/@statusline/claude-plugin"
BIN="$WORK/install/node_modules/.bin/statusline"

for f in .claude-plugin/plugin.json commands/setup.md commands/config.md commands/uninstall.md \
         hooks/hooks.json scripts/bootstrap.sh scripts/postinstall.mjs; do
  [ -f "$PKG/$f" ] || fail "claude-plugin tarball is missing $f"
done
[ -x "$PKG/bin/statusline" ] || fail "bin/statusline is not executable in the tarball"
ok "claude-plugin ships the plugin files and an executable binary"

export CLAUDE_CONFIG_DIR="$WORK/config"
PAYLOAD='{"session_id":"smoke","model":{"id":"claude-sonnet-5-5","display_name":"Sonnet 5.5"},"cost":{"total_cost_usd":0.5},"context_window":{"context_window_size":200000,"used_percentage":12}}'
OUT="$(echo "$PAYLOAD" | "$BIN" 2>&1)" || fail "binary failed: $OUT"
case "$OUT" in *"Sonnet 5.5"*) ok "binary renders a status line";; *) fail "unexpected output: $OUT";; esac

"$BIN" install --configure >/dev/null || fail "install --configure failed"
grep -q '"statusLine"' "$WORK/config/settings.json" || fail "install did not write statusLine"
ok "install --configure wrote settings.json"
"$BIN" uninstall >/dev/null || fail "uninstall failed"
if grep -q '"statusLine"' "$WORK/config/settings.json"; then fail "uninstall left statusLine behind"; fi
ok "uninstall removed it"

for pkg in core opencode-plugin; do
  [ -f "$WORK/install/node_modules/@statusline/$pkg/dist/index.js" ] || fail "@statusline/$pkg has no dist/index.js"
done
[ -f "$WORK/install/node_modules/@statusline/opencode-plugin/dist/tui.js" ] || fail "opencode-plugin has no dist/tui.js"
# The OpenCode plugin imports @opencode/plugin, a peer dependency that OpenCode
# provides at runtime, so it cannot be imported under plain Node; check its files.
node --input-type=module -e "await import('@statusline/core')" \
  || fail "@statusline/core does not import"
ok "core imports; opencode-plugin ships index.js and tui.js"

echo "All smoke checks passed."
