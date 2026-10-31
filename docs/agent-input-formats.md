# Agent Input Format Specification

## Overview
This document specifies the JSON input formats for status line plugins across different coding agents.

**Our adapter architecture supports agents with an external command mechanism:**
- Agent spawns a command periodically
- JSON payload sent on stdin
- ANSI string returned on stdout
- Refresh interval configurable (typically 100ms–30s)

Only **Claude Code** and **Cursor** have this exact mechanism. Other agents use different approaches documented below.

## Supported Agents (Compatible with Our Adapter)

| Agent | Status Line Mechanism | Config Location | Similarity to Claude Code |
|-------|----------------------|-----------------|---------------------------|
| **Claude Code** | ✅ `statusLine.command` (JSON stdin → ANSI stdout) | `~/.claude/settings.json` | Reference (100%) |
| **Cursor** | ✅ `statusLine.command` (JSON stdin → ANSI stdout) | `~/.cursor/cli-config.json` | Very high (~95%) |

---

## 1. Claude Code (Reference)

### Configuration
```json
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline/statusline",
    "refreshInterval": 15
  }
}
```

### Input JSON Schema
```typescript
interface ClaudeCodeStatusInput {
  hook_event_name?: "Status"; // not sent by Claude Code 2.1.x; do not rely on it
  session_id: string;
  transcript_path: string;
  cwd: string;
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
    added_dirs: string[];
  };
  version: string;
  output_style: { name: string };
  cost: {
    total_cost_usd: number;
    total_duration_ms: number;
    total_api_duration_ms: number;
    total_lines_added: number;
    total_lines_removed: number;
  };
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
    used_percentage: number | null;
    remaining_percentage: number | null;
  };
  rate_limits?: {
    five_hour?: { used_percentage: number; resets_at: number };
    seven_day?: { used_percentage: number; resets_at: number };
    spend_limit?: { used_percentage: number; resets_at: number; period: string };
    [key: string]: { used_percentage: number; resets_at: number } | undefined;
  };
  vim?: { mode: "INSERT" | "NORMAL" };
  agent?: { name: string; type?: string };
  worktree?: { name: string; path: string; branch?: string; original_cwd?: string; original_branch?: string };
  fast_mode?: boolean;
  effort?: { level: string | null };
  prompt_cache?: {
    ttl?: number | string; // seconds, or "5m" / "1h" (Claude Code 2.1.x sends a string)
    warm?: boolean;
    expires_at?: number;
    requests?: number;
    hit_ratio?: number;
    recache_tokens_if_cold?: number;
  };
}
```

### Key Fields for Status Line
| Unified Field | Claude Code Path |
|---------------|------------------|
| `model.id` | `model.id` |
| `model.displayName` | `model.display_name` |
| `context.usedTokens` | `context_window.total_input_tokens + context_window.total_output_tokens` |
| `context.maxTokens` | `context_window.context_window_size` |
| `context.usedPercentage` | `context_window.used_percentage` |
| `usage.inputTokens` | `context_window.total_input_tokens` |
| `usage.outputTokens` | `context_window.total_output_tokens` |
| `usage.cacheReadTokens` | `context_window.current_usage?.cache_read_input_tokens` |
| `usage.cacheWriteTokens` | `context_window.current_usage?.cache_creation_input_tokens` |
| `cost.sessionCostUsd` | `cost.total_cost_usd` |
| `cache.ttlSeconds` | `prompt_cache.ttl` (parsed: `"1h"` → 3600, `"5m"` → 300) |
| `cache.requests` | `prompt_cache.requests` |
| `cache.warm` | `prompt_cache.warm` |
| `cache.hitRatio` | `prompt_cache.hit_ratio` |
| `cache.expiresAt` | `prompt_cache.expires_at` |
| `rateLimits` | `rate_limits` |

---

## 2. Cursor

### Configuration
```json
// ~/.cursor/cli-config.json
{
  "statusLine": {
    "type": "command",
    "command": "~/.cursor/statusline.sh",
    "padding": 2,
    "updateIntervalMs": 300,
    "timeoutMs": 2000
  }
}
```

### Input JSON Schema
```typescript
interface CursorStatusInput {
  session_id: string;
  session_name?: string;
  transcript_path: string;
  render_width_chars: number;
  cwd: string;
  autorun: boolean;
  model: {
    id: string;
    display_name: string;
    param_summary?: string;
    max_mode?: boolean;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
    added_dirs: string[];
  };
  version: string;
  output_style: { name: "default" | "compact" };
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number | null;
    context_window_size: number;
    used_percentage: number | null;
    remaining_percentage: number | null;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
    } | null;
  };
  vim?: { mode: "NORMAL" | "INSERT" };
  worktree?: { name: string; path: string };
}
```

### Key Fields for Status Line
| Unified Field | Cursor Path |
|---------------|-------------|
| `model.id` | `model.id` |
| `model.displayName` | `model.display_name` |
| `model.paramSummary` | `model.param_summary` (extension) |
| `model.maxMode` | `model.max_mode` (extension) |
| `context.usedTokens` | `context_window.total_input_tokens + context_window.total_output_tokens` |
| `context.maxTokens` | `context_window.context_window_size` |
| `context.usedPercentage` | `context_window.used_percentage` |
| `usage.inputTokens` | `context_window.total_input_tokens` |
| `usage.outputTokens` | `context_window.total_output_tokens` |
| `cost.sessionCostUsd` | ❌ Not available |
| `cache` | ❌ Not available |
| `rateLimits` | ❌ Not available |
| `renderWidthChars` | `render_width_chars` (extension) |
| `vimMode` | `vim.mode` (extension) |
| `worktree` | `worktree` (extension) |

### Differences from Claude Code
| Aspect | Claude Code | Cursor |
|--------|-------------|--------|
| Cost tracking | ✅ `cost.total_cost_usd` | ❌ Not available |
| Prompt cache | ✅ Full cache info | ❌ Not available |
| Rate limits | ✅ Multiple windows | ❌ Not available |
| Terminal width | Auto-detect via `stty` | ✅ `render_width_chars` provided |
| Vim mode | ✅ `vim.mode` | ✅ `vim.mode` |
| Worktree | ✅ `worktree` | ✅ `worktree` |
| Model param summary | ❌ | ✅ `model.param_summary` |
| Max mode | ❌ | ✅ `model.max_mode` |
| Output style | ✅ | ✅ |
| Auto-run | ❌ | ✅ `autorun` |

---

## Field Mapping Table

| Unified Model Field | Claude Code | Cursor | Notes |
|---------------------|-------------|--------|-------|
| `agent` | "claude-code" | "cursor" | Required |
| `sessionId` | `session_id` | `session_id` | Required |
| `timestamp` | `Date.now()` | `Date.now()` | Client-side |
| `model.id` | `model.id` | `model.id` | Required |
| `model.displayName` | `model.display_name` | `model.display_name` | Required |
| `model.provider` | "anthropic" | "anthropic" | Inferred |
| `model.capabilities` | - | `paramSummary`, `maxMode` | Extensions |
| `context.usedTokens` | `total_input + total_output` | `total_input + total_output` | |
| `context.maxTokens` | `context_window_size` | `context_window_size` | |
| `context.usedPercentage` | `used_percentage` | `used_percentage` | |
| `usage.inputTokens` | `total_input_tokens` | `total_input_tokens` | |
| `usage.outputTokens` | `total_output_tokens` | `total_output_tokens` | |
| `usage.cacheReadTokens` | `current_usage.cache_read_input_tokens` | ❌ | |
| `usage.cacheWriteTokens` | `current_usage.cache_creation_input_tokens` | ❌ | |
| `cost.sessionCostUsd` | `cost.total_cost_usd` | ❌ | |
| `cost.currency` | "USD" | "USD" | |
| `cache.ttlSeconds` | `prompt_cache.ttl` | ❌ | |
| `cache.warm` | `prompt_cache.warm` | ❌ | |
| `cache.hitRatio` | `prompt_cache.hit_ratio` | ❌ | |
| `cache.expiresAt` | `prompt_cache.expires_at` | ❌ | |
| `rateLimits` | `rate_limits` | ❌ | |
| `extensions.renderWidthChars` | ❌ | `render_width_chars` | Cursor-specific |
| `extensions.vimMode` | `vim.mode` | `vim.mode` | Both |
| `extensions.worktree` | `worktree` | `worktree` | Both |
| `extensions.autorun` | ❌ | `autorun` | Cursor-specific |
| `extensions.outputStyle` | `output_style.name` | `output_style.name` | Both |

---

## Agents with Different Mechanisms (Not Compatible with Our Adapter)

### Windsurf (Codeium)
- **Type**: Autocomplete/inline completion tool (Neovim/VS Code extensions)
- **Interface**: Local language server (HTTP/JSON-RPC) on random port
- **Auth**: API key required (`sk-ws-...`)
- **Status Data**: Completion state via `status_string()` → returns `'3/8'`, `'0'`, or `'*'`
- **Mechanism**: Editor-integrated only (lualine, lightline, VS Code status bar)
- **Data Available**: Credit usage via `GetUserStatus` RPC
- **Why Not Compatible**: No external command hook; status shown via editor's own status line API

### Cline
- **Type**: VS Code extension (AI coding agent)
- **Interface**: VS Code Extension API (`ClineAPI`), gRPC-over-postMessage
- **State**: `ExtensionState` with `turnState`, `apiConfiguration`, `taskHistory`, token usage, cost
- **Mechanism**: WebView UI (React) + internal status bar in VS Code panel
- **Feature Request**: #2622 (expose local API/CLI for remote control)
- **Why Not Compatible**: No stdin/stdout mechanism; state is internal to VS Code extension host

### Continue.dev
- **Type**: IDE extension (VS Code, JetBrains) + CLI (`cn`)
- **Config**: `~/.continue/config.yaml`
- **VS Code**: Uses `vscode.StatusBarItem` (internal `setupStatusBar()` function)
- **CLI**: No status line mechanism; TUI has no footer/status bar
- **Data Available**: Model config, autocomplete status, context providers
- **Why Not Compatible**: VS Code extension uses internal status bar API; CLI has no status line hook

### Aider
- **Type**: CLI coding agent
- **Interface**: `--message-format stream-json` outputs JSONL events
- **Event Stream**: `init` → `message`* → `tool_use`* → `tool_result`* → `result`
- **Event Types**: `init` (session_id, model), `message` (role, content, delta), `tool_use`, `tool_result`, `result` (stats with tokens, cost)
- **Mechanism**: Streaming JSONL during execution, not periodic status snapshots
- **Why Not Compatible**: Different paradigm—streaming event log vs. periodic status snapshot. Would need a state-accumulating adapter that processes the stream.

### Zed
- **Type**: Code editor with extensions
- **Extensions**: Provide languages, themes, debuggers, snippets, MCP servers
- **Status Bar**: Built-in only; extension API has no status bar items (RFC #53403, issue #28682)
- **Current Extension Trait**: Only language servers, debuggers, completions, slash commands
- **Why Not Compatible**: No status bar API in extension system yet (RFC in draft)

### OpenCode
- **Type**: CLI/TUI agent
- **Mechanism**: TUI plugins (in-process TypeScript/JSX rendering to slots)
- **Config**: `cli.json` / `tui.json` with `plugins: ["pkg"]`
- **Slots**: `prompt.footer.status`, `session_prompt_right`, `home.footer.status`, `sidebar.content`
- **Template System**: Native templates in `tui.status_line.templates` with variables like `{model_id}`, `{total_tokens}`, `{context_used_pct}`
- **Why Not Compatible**: In-process plugin architecture (loads `.tsx`), not external command. No stdin/stdout contract.

---

## Implementation Priority

Given the above analysis:

1. **Phase 1-2**: ✅ Complete — Claude Code (reference) + Cursor adapter
2. **Phase 3**: No additional agents with compatible status line mechanisms exist
3. **Future**: If any agent adds an external command + JSON stdin/stdout mechanism, add adapter

---

## Example Payloads

### Claude Code (Minimal)
```json
{
  "hook_event_name": "Status",
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/Users/me/project",
  "model": { "id": "claude-3-5-sonnet-20241022", "display_name": "Claude Sonnet 5.5" },
  "workspace": { "current_dir": "/Users/me/project", "project_dir": "/Users/me/project", "added_dirs": [] },
  "version": "1.0.71",
  "output_style": { "name": "default" },
  "cost": { "total_cost_usd": 5.60, "total_duration_ms": 120000, "total_api_duration_ms": 45000, "total_lines_added": 100, "total_lines_removed": 20 },
  "context_window": { "total_input_tokens": 15000, "total_output_tokens": 5000, "context_window_size": 200000, "current_usage": { "input_tokens": 8000, "output_tokens": 1200, "cache_creation_input_tokens": 2000, "cache_read_input_tokens": 500 }, "used_percentage": 42.5, "remaining_percentage": 57.5 },
  "rate_limits": { "five_hour": { "used_percentage": 12, "resets_at": 1700003600 }, "seven_day": { "used_percentage": 55, "resets_at": 1700600000 } },
  "vim": { "mode": "NORMAL" }
}
```

### Cursor (Minimal)
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "render_width_chars": 120,
  "cwd": "/Users/me/project",
  "autorun": false,
  "model": { "id": "claude-4-opus", "display_name": "Claude 4 Opus", "param_summary": "(Thinking)", "max_mode": true },
  "workspace": { "current_dir": "/Users/me/project", "project_dir": "/Users/me/project/.cursor/transcripts", "added_dirs": [] },
  "version": "1.2.3",
  "output_style": { "name": "default" },
  "context_window": { "total_input_tokens": 15234, "total_output_tokens": null, "context_window_size": 200000, "used_percentage": 34.5, "remaining_percentage": 65.5, "current_usage": null },
  "vim": { "mode": "NORMAL" },
  "worktree": { "name": "my-feature", "path": "/Users/me/.cursor/worktrees/repo/my-feature" }
}
```

---

## Adapter Implementation Notes

### Cursor Adapter Special Handling
1. **Missing cost** - Display "N/A" or omit cost section
2. **Missing cache** - Omit cache section
3. **Missing rate limits** - Omit rate limits section
4. **Use `render_width_chars`** - Prefer over auto-detection
5. **Include extensions** - `paramSummary`, `maxMode`, `autorun`, `renderWidthChars`, `vimMode`, `worktree`

### Detection Logic
```typescript
function canHandle(input: unknown): boolean {
  const obj = input as Record<string, unknown>;
  
  // Cursor: has render_width_chars and autorun (model.param_summary is optional)
  if (typeof obj.render_width_chars === "number" && 
      typeof obj.autorun === "boolean" &&
      obj.model && typeof obj.model === "object") {
    return true;
  }
  
  // Claude Code: session_id, transcript_path and context_window, and none of the Cursor
  // markers. hook_event_name and rate_limits are NOT always sent (rate_limits is subscription-only).
  if (typeof obj.session_id === "string" &&
      typeof obj.transcript_path === "string" &&
      obj.context_window && typeof obj.context_window === "object" &&
      !("render_width_chars" in obj)) {
    return true;
  }
  
  return false;
}
```

### Priority Order
1. Cursor (more specific fields)
2. Claude Code (fallback)