---
description: Install and configure the status line plugin (--force to replace an existing one, --interval N for refresh seconds)
disable-model-invocation: true
allowed-tools: Bash
---

The plugin binary lives at `${CLAUDE_PLUGIN_ROOT}/bin/statusline`. The SessionStart hook builds it automatically on first run, but for the initial setup we build it explicitly to avoid waiting.

**Build the binary if it's missing:**

```bash
if [ ! -x "${CLAUDE_PLUGIN_ROOT}/bin/statusline" ]; then
  cd "${CLAUDE_PLUGIN_ROOT}" && npm install --silent && npm run build:core && npm run build && chmod +x bin/statusline
fi
```

**Install + configure:**

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/statusline" install --configure $ARGUMENTS
```

Report its output verbatim. If it says a different statusLine is already set, tell the user to re-run with `--force` to replace it.

After this, `/statusline-show`, `/statusline-model`, `/statusline-sections`, etc. work without spending a model turn.
