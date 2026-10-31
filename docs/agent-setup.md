# Agent setup

One guide per agent:

| Agent | Guide | Install in one line |
|---|---|---|
| **Claude Code** | [claude-code.md](claude-code.md) | `/plugin marketplace add sergemso/ai-tools.agent-status-line`, `/plugin install statusline@claude-code-status-line`, `/statusline:setup` |
| **Cursor** | [cursor.md](cursor.md) | `curl -fsSL …/scripts/install-cursor.sh \| bash`, then add the `statusLine` entry |
| **OpenCode** | [opencode.md](opencode.md) | `opencode plugin add @statusline/opencode-plugin` |

Settings, environment variables and the wizard are shared: see the [README](../README.md#configuration). To support another agent, see [adding-adapters.md](adding-adapters.md).

The images in these guides are generated from real output by `npm run docs:images` (after building); they are not screenshots of the agents' UIs.
