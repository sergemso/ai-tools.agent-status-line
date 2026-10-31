---
description: Install and configure the status line plugin (--force to replace an existing one, --interval N for refresh seconds)
disable-model-invocation: true
allowed-tools: Bash, Read, AskUserQuestion
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

Report its output verbatim. If it says a different statusLine is already set, tell the user to re-run with `--force` to replace it, and stop.

**Customize:** once the install succeeded, ask with AskUserQuestion "Customize the status line now?" (options: "Yes, walk me through it", "No, keep defaults"). On yes, Read `${CLAUDE_PLUGIN_ROOT}/commands/config.md` and follow its guided flow for empty `$ARGUMENTS` (starting with `config show`), looping until the user is done. On no, mention they can run `/statusline:config` any time.

After this, `/statusline-show`, `/statusline-model`, `/statusline-sections`, etc. work without spending a model turn.
