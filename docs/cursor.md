# Cursor

Cursor uses the same external-command contract as Claude Code: it pipes a JSON payload to the command's stdin and shows what it prints. The binary detects Cursor by its payload (it carries `render_width_chars` and `autorun`; `model.param_summary` is optional because the CLI leaves it out when empty) and adapts.

![The Cursor status line at 38%, 62% and 88% context use](images/cursor.svg)

*Real output of the built binary for Cursor payloads, not a screenshot of Cursor.*

![The status line under the prompt in a real Cursor Agent CLI session](images/live-cursor.svg)

*Captured from the Cursor Agent CLI 2026.10.22 (tmux pane, Auto model, after one message), then rendered to SVG with `scripts/render-live-capture.mjs`. The separator is the `•` from the author's saved settings.*

## What you see

Cursor's payload carries the model, the context window and token totals, but not session cost, prompt-cache timing or rate limits. So the line is shorter than in Claude Code:

| You see | It means |
|---|---|
| `Claude Sonnet 5.5` | Model. |
| `▕▄▏ 38%/200k` | Context used / window. Green below 50%, yellow from 50%, red from 80%. |
| `76.0k` | Tokens in the session. |

`autorun`, `max_mode` and `param_summary` are read into the internal model but are **not drawn** today. Width comes from `render_width_chars`, so no terminal detection is needed.

## Install

```bash
npx @statusline/claude-plugin install
```

This runs the published, prebuilt package (Node ≥ 18, no git or build), copies the binary to `~/.claude/statusline/statusline` and prints a JSON snippet. It does not touch Claude Code's `settings.json` (that needs `--configure`). Add the snippet to Cursor's configuration yourself (the command does not), then restart Cursor. A wrapper that does the same and also prints the settings locations: `curl -fsSL https://raw.githubusercontent.com/sergemso/ai-tools.agent-status-line/main/scripts/install-cursor.sh | bash`.

```json
{
  "statusLine": {
    "type": "command",
    "command": "/home/you/.claude/statusline/statusline"
  }
}
```

Use an absolute path. There is no marketplace route: Cursor has no public plugin registry for status lines.

> **Where the entry goes.** For the **Cursor Agent CLI** (`cursor-agent`, 2026.10.22) it is `statusLine` in `~/.cursor/cli-config.json`, checked against a running CLI: the key is in its config schema, it calls the command, and it draws the output under the prompt (`Auto • ▕▁▏ 5%/256k • 12.3k` after one message). The optional fields are `padding`, `updateIntervalMs` and `timeoutMs`. For the **Cursor desktop app** the install script and README name its `settings.json` (`~/.config/Cursor/User/settings.json` on Linux, `~/Library/Application Support/Cursor/User/settings.json` on macOS, `%APPDATA%\Cursor\User\settings.json` on Windows); that one is **not verified**. If the line does not appear in the app, please report whether it was `settings.json` or `cli-config.json`.

A fresh CLI session sends `null` for every `context_window` field and `model` `default` / `Auto` with no `param_summary`; the line then shows `0%` and `0` until the first message.

From a clone instead: `npm install`, then copy `bin/statusline` to `~/.claude/statusline/` and add the entry above.

## Check it works

```bash
echo '{"session_id":"t","render_width_chars":100,"autorun":false,"model":{"id":"claude-sonnet-5-5","display_name":"Claude Sonnet 5.5","param_summary":"","max_mode":false},"workspace":{"current_dir":"/tmp","project_dir":"/tmp","added_dirs":[]},"context_window":{"total_input_tokens":76000,"total_output_tokens":0,"context_window_size":200000,"used_percentage":38,"remaining_percentage":62,"current_usage":{"input_tokens":76000,"output_tokens":0}}}' \
  | ~/.claude/statusline/statusline
```

`statusline agent detect file.json` tells you which adapter claims a payload.

## Configure, update, remove

Settings are shared with Claude Code (`~/.claude/statusline/config`), so `statusline config format glyph`, `config separator ·` and the wizard work the same way; sections that need data Cursor does not send are simply absent. Update by re-running the install command (`npx @statusline/claude-plugin@latest install`). Remove the `statusLine` entry from Cursor's configuration and delete `~/.claude/statusline/`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing appears | Restart Cursor; check the command path exists and is executable; see [Where the entry goes](#install) above about which file Cursor reads. |
| Wrong agent detected | `statusline agent detect payload.json`; Cursor payloads are matched before Claude Code's, on the Cursor-only fields. |
| No cost or cache timer | Cursor does not send them. |

Adding another agent that works this way: [`adding-adapters.md`](adding-adapters.md).
