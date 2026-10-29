---
description: Install and configure the status line plugin (--force to replace an existing one, --interval N for refresh seconds)
disable-model-invocation: true
allowed-tools: Bash
---

Run the installer using the bundled binary:

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/statusline" install --configure $ARGUMENTS
```

Report its output verbatim. If it says a different statusLine is already set, tell the user to re-run with `--force` to replace it.

If the binary is missing (e.g. fresh checkout without a build), fall back to:

```bash
cd "${CLAUDE_PLUGIN_ROOT}" && npm install && npm run build && ./bin/statusline install --configure $ARGUMENTS
```
