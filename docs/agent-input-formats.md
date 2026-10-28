# Agent Input Format Specification

## Overview
This document specifies the JSON input formats for status line plugins across different coding agents. Only agents with a **status line plugin mechanism** (receiving JSON on stdin, writing formatted output to stdout) are included.

## Supported Agents

| Agent | Status Line Mechanism | Config Location | Similarity to Claude Code |
|-------|----------------------|-----------------|---------------------------|
| **Claude Code** | ✅ Full support | `~/.claude/settings.json` | Reference (100%) |
| **Cursor** | ✅ Full support | `~/.cursor/cli-config.json` | Very high (~95%) |
| Windsurf | ❌ No mechanism | N/A | N/A |
| Cline | ❌ No mechanism | N/A | N/A |
| Continue.dev | ❌ No mechanism | N/A | N/A |
| Aider | ❌ No mechanism | N/A | N/A |
| Zed | ❌ No mechanism | N/A | N/A |

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
  hook_event_name: "Status";
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
    ttl?: number;
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
| `cache.ttlSeconds` | `prompt_cache.ttl` |
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

## Unsupported Agents (No Status Line Mechanism)

### Windsurf (Codeium)
- **Type**: Autocomplete/inline completion tool
- **Interface**: Local language server (HTTP/JSON-RPC) on random port
- **Auth**: API key required (`sk-ws-...`)
- **Data Available**: Credit usage via `GetUserStatus` RPC, completion state via `status_string()`
- **Status Line**: No plugin mechanism; status shown via Neovim/VS Code extensions (lualine, etc.)

### Cline
- **Type**: VS Code extension (AI coding agent)
- **Interface**: VS Code Extension API (`ClineAPI`) for other extensions
- **Data Available**: Task state, token usage, cost, context window via extension messages
- **Status Line**: No plugin mechanism; UI is within VS Code panel

### Continue.dev
- **Type**: IDE extension (VS Code, JetBrains) + CLI
- **Interface**: JSON-RPC protocol (`core/protocol/core.ts`), REST API for Hub
- **Data Available**: Free trial status, chat/autocomplete limits, model config
- **Status Line**: No plugin mechanism; UI integrated in IDE

### Aider
- **Type**: CLI coding agent
- **Interface**: `--message-format stream-json` outputs JSONL events
- **Data Available**: Token usage, cost, model info via JSONL events
- **Status Line**: No plugin mechanism; runs in terminal

### Zed
- **Type**: Code editor with extensions
- **Extensions**: Provide languages, themes, debuggers, snippets, MCP servers
- **Status Bar**: Built-in only; extensions cannot add status bar items
- **Status Line**: No plugin mechanism; feature request open

---

## Implementation Priority

Given the above analysis, the implementation priority should be:

1. **Phase 1-2**: Claude Code (reference) + Cursor adapter
2. **Phase 3**: No additional agents with status line mechanisms exist
3. **Future**: If any agent adds a status line mechanism, add adapter

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
  
  // Cursor: has render_width_chars, autorun, model.param_summary
  if (typeof obj.render_width_chars === "number" && 
      typeof obj.autorun === "boolean" &&
      obj.model && typeof obj.model.param_summary === "string") {
    return true;
  }
  
  // Claude Code: has hook_event_name === "Status", prompt_cache, rate_limits
  if (obj.hook_event_name === "Status" &&
      obj.prompt_cache &&
      obj.rate_limits) {
    return true;
  }
  
  return false;
}
```

### Priority Order
1. Cursor (more specific fields)
2. Claude Code (fallback)