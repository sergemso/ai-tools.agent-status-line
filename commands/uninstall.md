---
description: Remove the status line — drops the statusLine entry from settings.json and deletes the copied binary (--purge also deletes your saved settings)
disable-model-invocation: true
allowed-tools: Bash
---

Disabling or uninstalling the plugin does not stop the status line, because `statusLine` lives in your own `settings.json`. This undoes what `/statusline:setup` wrote.

```bash
chmod +x "${CLAUDE_PLUGIN_ROOT}/bin/statusline"
"${CLAUDE_PLUGIN_ROOT}/bin/statusline" uninstall $ARGUMENTS
```

Report its output verbatim. Your saved settings (`~/.claude/statusline/config`) are kept unless `--purge` is passed. Afterwards, tell the user they can disable or uninstall the plugin with `/plugin`, and that the status line disappears on the next refresh or restart.
