# @statusline/opencode-plugin

OpenCode TUI plugin that renders a [@statusline/core](../core) status line
(model · context · cost · tokens) into the OpenCode footer.

## How it works

OpenCode v2 does **not** expose an external-command status-line contract
(like Claude Code's `statusLine.command` setting). Instead, status-line
customisation is done via **in-process TUI plugins** that claim a slot in
the footer render tree.

This package is such a plugin. It has two parts:

- `.` (`dist/index.js`) — a no-op **server** plugin. OpenCode loads this in
  the server process, where there is no TUI context.
- `./tui` (`dist/tui.js`) — the **TUI** plugin that renders the status line.

The TUI part:

1. Runs inside the OpenCode TUI process.
2. Subscribes to session / model / VCS data via `@opencode/plugin/tui`.
3. Adapts that data into a `CoreRenderInput` (the shape `@statusline/core`
   sections expect).
4. Runs the section-priority pipeline (`getSections` → `buildLayout` →
   `cliRenderer`) to produce an ANSI-coloured string.
5. Converts the ANSI string into coloured `<text>` spans (because
   `@opentui/solid` does not interpret raw ANSI) and renders them into the
   `prompt.footer.status` slot.

Keeping the two parts separate is required: if the TUI entry is exposed as
the package's `.` entry, OpenCode runs it in the server process and setup
fails with `context.data.listen is undefined`.

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

### 1. Install from npm

```bash
opencode plugin add @statusline/opencode-plugin
```

This registers the package in `~/.config/opencode/opencode.json`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "@statusline/opencode-plugin"
  ]
}
```

OpenCode loads the package's server part (a no-op) and its TUI part
automatically. Pin a version with `@statusline/opencode-plugin@1.0.10` if
needed.

### 2. Local development

Build the package, then install it with npm or link it into the OpenCode
plugin cache. OpenCode 2.1.4 does not load arbitrary local paths from the
`plugins` array, so use a published version (or a local npm registry) when
testing the install flow.

From the repository root:

```bash
npm install
npm run build:core        # build @statusline/core
npm run build --workspace=@statusline/opencode-plugin
```

This produces `packages/opencode-plugin/dist/index.js` (server part) and
`packages/opencode-plugin/dist/tui.js` (TUI part).

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
options when registering the package:

```jsonc
{
  "plugins": [
    {
      "package": "@statusline/opencode-plugin",
      "options": { "sections": "model,context,cost" }
    }
  ]
}
```

Available legacy section names: `model`, `context`, `cost`, `tokens`,
`overhead`, `cache`, `stats`, `resets`, `vim`, `worktree`.

### Sharing the footer with OpenCode

OpenCode's footer already shows context usage, cost and the
`ctrl+p commands` hint on the right. By default the plugin therefore
renders only `model,tokens,resets` there and leaves a two-column gutter so
the two never touch. Pass `sections` to add more back.

To avoid the shared row entirely, render on its own full-width line above
the prompt:

```jsonc
{
  "plugins": [
    {
      "package": "@statusline/opencode-plugin",
      "options": { "placement": "composer-top" }
    }
  ]
}
```

`placement` accepts `replace` (default, takes over the footer status slot),
`append` (adds to it) and `composer-top`. In `composer-top` the default
sections are `model,context,cost,tokens,resets`. `worktree` is never on by
default; add it via `sections` if you want the branch.

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
packages/opencode-plugin/src/tui.tsx      ← define({ id, setup })
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
