# @statusline/opencode-plugin

OpenCode TUI plugin that renders a [@statusline/core](../core) status line
(model · context · cost · tokens) into the OpenCode footer.

## How it works

OpenCode v2 does **not** expose an external-command status-line contract
(like Claude Code's `statusLine.command` setting). Instead, status-line
customisation is done via **in-process TUI plugins** that claim a slot in
the footer render tree.

This package is such a plugin. It:

1. Runs inside the OpenCode TUI process (loaded from `.opencode/plugins/`).
2. Subscribes to session / model / VCS data via `@opencode/plugin/tui`.
3. Adapts that data into a `CoreRenderInput` (the shape `@statusline/core`
   sections expect).
4. Runs the section-priority pipeline (`getSections` → `buildLayout` →
   `cliRenderer`) to produce an ANSI-coloured string.
5. Converts the ANSI string into coloured `<text>` spans (because
   `@opentui/solid` does not interpret raw ANSI) and renders them into the
   `prompt.footer.status` slot.

### What is rendered

| Section    | Source in OpenCode                          | Notes                                      |
| ---------- | ------------------------------------------- | ------------------------------------------ |
| `model`    | `SessionInfo.model` → `ModelInfo.name`      | Display name from the model registry       |
| `context`  | `SessionInfo.tokens` vs `ModelInfo.limit.context` | Percentage computed (opencode doesn't expose it) |
| `cost`     | `SessionInfo.cost`                          | Cumulative session cost in USD             |
| `tokens`   | `SessionInfo.tokens.input + output`         | Total session tokens                       |

Sections that depend on data OpenCode does not expose are disabled:

| Section     | Reason                                                |
| ----------- | ----------------------------------------------------- |
| `cache`     | No prompt-cache TTL / warm / hit-ratio in opencode    |
| `resets`    | No rate-limit windows in session data                 |
| `overhead`  | No `recache_tokens_if_cold` field                     |
| `vim`       | No vim mode in opencode session data                  |
| `worktree`  | Mapped from `VcsInfo.branch` if present               |

## Installation

### 1. Build the plugin

From the repository root:

```bash
npm install
npm run build:core        # build @statusline/core
npm run build             # build the opencode plugin (packages/opencode-plugin)
```

This produces `packages/opencode-plugin/dist/index.js`.

### 2. Register the plugin with OpenCode

Create or edit `~/.config/opencode/opencode.json` (global) or
`opencode.json` in your project:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "@statusline/opencode-plugin"
  ]
}
```

Or, for a local development checkout, point directly at the built file:

```jsonc
{
  "plugins": [
    "/absolute/path/to/claude-code-status-line/packages/opencode-plugin/dist/index.js"
  ]
}
```

OpenCode loads plugins from `.opencode/plugins/` as well — you can symlink
the built package there:

```bash
mkdir -p ~/.config/opencode/plugins
ln -s /path/to/claude-code-status-line/packages/opencode-plugin \
  ~/.config/opencode/plugins/statusline
```

### 3. Start the OpenCode TUI

```bash
opencode
```

The status line appears in the footer, replacing the default
`prompt.footer.status` content.

## ACP mode (does NOT apply)

OpenCode can run in two modes:

| Mode            | Command        | Status line works? | Why                                 |
| --------------- | -------------- | ------------------ | ----------------------------------- |
| **TUI (client)**| `opencode`     | ✅ Yes              | The TUI renders the footer; plugins claim slots. |
| **ACP (server)**| `opencode acp` | ❌ No               | ACP is a protocol for editors (Zed, JetBrains). The editor renders its own UI; opencode just serves the agent over JSON-RPC. There is no TUI footer to claim. |

If you want a status line in an ACP-connected editor, use that editor's
own status-bar extension API — the `@statusline/core` library can be
reused via a custom renderer (e.g. the VS Code renderer), but the
in-process TUI plugin from this package does not apply.

## Configuration

The plugin uses sensible defaults. To override the enabled sections, pass
options when creating the plugin:

```ts
// .opencode/plugins/statusline/index.ts
import { define } from "@opencode/plugin/tui";
import { createStatusLinePlugin } from "@statusline/opencode-plugin";

export default define(
  createStatusLinePlugin({
    sections: "model,context,cost",  // legacy comma-separated names
  }),
);
```

Available legacy section names: `model`, `context`, `cost`, `tokens`,
`overhead`, `cache`, `stats`, `resets`, `vim`, `worktree`.

## Development

```bash
# Run unit tests (no OpenCode installation needed)
cd packages/opencode-plugin
npm test

# Type-check
npm run build
```

Tests cover the three pure modules:

- `adapter.ts` — opencode `SessionInfo` → `CoreRenderInput` mapping
- `render.ts` — `CoreRenderInput` → ANSI string via `@statusline/core`
- `ansi.ts` — ANSI string → coloured spans for `@opentui/solid`

## Architecture

```
OpenCode TUI
  │
  │  (in-process plugin load)
  ▼
packages/opencode-plugin/src/plugin.tsx   ← define({ id, setup })
  │
  │  context.data.session.get(id)
  │  context.data.model.list()
  │  context.data.location.vcs.info()
  ▼
src/adapter.ts                            ← adaptSession(): SessionInfo → CoreRenderInput
  │
  ▼
src/render.ts                             ← renderStatusLine(): CoreRenderInput → ANSI
  │                                         (uses @statusline/core pipeline)
  ▼
src/ansi.ts                               ← ansiToSpans(): ANSI → Span[]
  │
  ▼
<text fg={...}> spans                     ← rendered into prompt.footer.status slot
```

## License

MIT
