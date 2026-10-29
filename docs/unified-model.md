# Unified Model Reference

Complete field reference for the `UnifiedStatusInput` interface used internally by the status-line plugin.

## Type Definitions

```typescript
type AgentType = "claude-code" | "cursor";
```

## Core Interface

```typescript
interface UnifiedStatusInput {
  // Core identification
  agent: AgentType;           // Source agent type
  sessionId: string;          // Session identifier
  timestamp: number;          // Unix timestamp (ms) when parsed
  
  // Model info
  model: UnifiedModelInfo;
  
  // Context window
  context: UnifiedContext;
  
  // Token usage (session cumulative)
  usage: UnifiedUsage;
  
  // Cost tracking
  cost: UnifiedCost;
  
  // Prompt cache
  cache: UnifiedCache;
  
  // Rate limits
  rateLimits: RateLimitWindow[];
  
  // Agent-specific extensions
  extensions: UnifiedExtensions;
}
```

## Model Information

```typescript
interface UnifiedModelInfo {
  id: string;                 // Model ID (e.g., "claude-3-5-sonnet-20241022")
  displayName: string;        // Human-readable name (e.g., "Claude Sonnet 5.5")
  provider: string;           // Provider (e.g., "anthropic", "openai")
  capabilities: ModelCapabilities;
}

interface ModelCapabilities {
  paramSummary?: string;      // Cursor: "(Thinking)", ""
  maxMode?: boolean;          // Cursor: true/false
  effortLevel?: string;       // Claude Code: "low" | "medium" | "high" | "xhigh" | "max"
  [key: string]: unknown;     // Future extensions
}
```

## Context Window

```typescript
interface UnifiedContext {
  usedTokens: number;         // Total tokens used (input + output)
  maxTokens: number;          // Context window size
  usedPercentage: number | null; // Percentage used (null if unknown)
}
```

## Token Usage

```typescript
interface UnifiedUsage {
  inputTokens: number;        // Total input tokens
  outputTokens: number;       // Total output tokens
  cacheReadTokens?: number;   // Cache read tokens (Claude Code)
  cacheWriteTokens?: number;  // Cache write tokens (Claude Code)
}
```

## Cost Tracking

```typescript
interface UnifiedCost {
  sessionCostUsd: number | null; // Session cost in USD (null if unavailable)
  totalCostUsd?: number;         // Lifetime cost (if available)
  currency: "USD";               // Always USD
}
```

## Prompt Cache

```typescript
interface UnifiedCache {
  ttlSeconds: number | null;      // Cache TTL in seconds (null if unknown)
  warm: boolean;                  // Whether cache is warm
  hitRatio?: number;              // Cache hit ratio (0-1)
  expiresAt?: number;             // Cache expiry timestamp (Unix seconds)
  recacheTokensIfCold?: number;   // Tokens needed to recache if cold
}
```

## Rate Limits

```typescript
interface RateLimitWindow {
  id: string;                 // Unique ID (e.g., "5h", "7d", "spend")
  name: string;               // Display name (e.g., "5h", "7d", "Spend limit")
  used: number | null;        // Used percentage (null if unknown)
  limit: number | null;       // Limit value (null if unknown)
  usedPercentage: number | null; // Used percentage (alias for used)
  resetsAt: number;           // Unix timestamp when window resets
  period: "5h" | "24h" | "7d" | "30d" | "custom";
}
```

## Extensions (Agent-Specific)

```typescript
interface UnifiedExtensions {
  // Cursor-specific
  renderWidthChars?: number;   // Terminal width from agent
  autorun?: boolean;           // Cursor auto-run mode
  paramSummary?: string;       // Model parameter summary
  maxMode?: boolean;           // Max mode enabled
  
  // Shared
  vimMode?: "NORMAL" | "INSERT";  // Vim mode
  worktree?: {                  // Git worktree info
    name: string;
    path: string;
    branch?: string;
  };
  outputStyle?: string;        // Output style name
  
  // Claude Code-specific
  fastMode?: boolean;          // Fast mode enabled
  
  // Allow arbitrary extensions
  [key: string]: unknown;
}
```

## Field Availability by Agent

| Field | Claude Code | Cursor | Notes |
|-------|-------------|--------|-------|
| `agent` | ✅ | ✅ | Always present |
| `sessionId` | ✅ | ✅ | Always present |
| `timestamp` | ✅ | ✅ | Client-side |
| `model.id` | ✅ | ✅ | Required |
| `model.displayName` | ✅ | ✅ | Required |
| `model.provider` | ✅ | ✅ | Inferred |
| `model.capabilities.effortLevel` | ✅ | ❌ | Claude Code only |
| `model.capabilities.paramSummary` | ❌ | ✅ | Cursor only |
| `model.capabilities.maxMode` | ❌ | ✅ | Cursor only |
| `context.usedTokens` | ✅ | ✅ | Calculated |
| `context.maxTokens` | ✅ | ✅ | Required |
| `context.usedPercentage` | ✅ | ✅ | May be null |
| `usage.inputTokens` | ✅ | ✅ | Required |
| `usage.outputTokens` | ✅ | ✅ | Required |
| `usage.cacheReadTokens` | ✅ | ❌ | Claude Code only |
| `usage.cacheWriteTokens` | ✅ | ❌ | Claude Code only |
| `cost.sessionCostUsd` | ✅ | ❌ | Null for Cursor |
| `cost.totalCostUsd` | ✅ | ❌ | If available |
| `cache.ttlSeconds` | ✅ | ❌ | Null for Cursor |
| `cache.warm` | ✅ | ❌ | False for Cursor |
| `cache.hitRatio` | ✅ | ❌ | Optional |
| `cache.expiresAt` | ✅ | ❌ | Optional |
| `cache.recacheTokensIfCold` | ✅ | ❌ | Optional |
| `rateLimits` | ✅ | ❌ | Empty array for Cursor |
| `extensions.renderWidthChars` | ❌ | ✅ | Cursor only |
| `extensions.autorun` | ❌ | ✅ | Cursor only |
| `extensions.vimMode` | ✅ | ✅ | Both |
| `extensions.worktree` | ✅ | ✅ | Both |
| `extensions.outputStyle` | ✅ | ✅ | Both |
| `extensions.fastMode` | ✅ | ❌ | Claude Code only |

## Type Guards

```typescript
function isUnifiedStatusInput(input: unknown): input is UnifiedStatusInput
```

Validates all required fields are present and correctly typed.

## Conversion Functions

### From Agent Input
```typescript
// Auto-detect and parse
adapterRegistry.parse(rawInput): UnifiedStatusInput

// Explicit agent type
adapterRegistry.parse(rawInput, "claude-code"): UnifiedStatusInput
```

### To Legacy Format (Backward Compatibility)
```typescript
unifiedToParsedInput(unified): ParsedInput
```

Converts to the legacy `ParsedInput` format used by the original formatter.

## Example Unified Models

### Claude Code (Full)
```json
{
  "agent": "claude-code",
  "sessionId": "abc123",
  "timestamp": 1700000000000,
  "model": {
    "id": "claude-3-5-sonnet-20241022",
    "displayName": "Claude Sonnet 5.5",
    "provider": "anthropic",
    "capabilities": { "effortLevel": "medium" }
  },
  "context": {
    "usedTokens": 20000,
    "maxTokens": 200000,
    "usedPercentage": 42.5
  },
  "usage": {
    "inputTokens": 15000,
    "outputTokens": 5000,
    "cacheReadTokens": 500,
    "cacheWriteTokens": 2000
  },
  "cost": {
    "sessionCostUsd": 5.60,
    "currency": "USD"
  },
  "cache": {
    "ttlSeconds": 3600,
    "warm": true,
    "hitRatio": 0.85,
    "expiresAt": 1700007200,
    "recacheTokensIfCold": 5000
  },
  "rateLimits": [
    { "id": "5h", "name": "5h", "used": 12, "limit": 100, "usedPercentage": 12, "resetsAt": 1700003600, "period": "5h" },
    { "id": "7d", "name": "7d", "used": 55, "limit": 100, "usedPercentage": 55, "resetsAt": 1700600000, "period": "7d" }
  ],
  "extensions": {
    "vimMode": "NORMAL",
    "outputStyle": "default",
    "fastMode": false
  }
}
```

### Cursor (Full)
```json
{
  "agent": "cursor",
  "sessionId": "cursor-abc123",
  "timestamp": 1700000000000,
  "model": {
    "id": "claude-4-opus",
    "displayName": "Claude 4 Opus",
    "provider": "anthropic",
    "capabilities": { "paramSummary": "(Thinking)", "maxMode": true }
  },
  "context": {
    "usedTokens": 15234,
    "maxTokens": 200000,
    "usedPercentage": 34.5
  },
  "usage": {
    "inputTokens": 15234,
    "outputTokens": 0
  },
  "cost": {
    "sessionCostUsd": null,
    "currency": "USD"
  },
  "cache": {
    "ttlSeconds": null,
    "warm": false
  },
  "rateLimits": [],
  "extensions": {
    "renderWidthChars": 120,
    "autorun": false,
    "paramSummary": "(Thinking)",
    "maxMode": true,
    "vimMode": "NORMAL",
    "worktree": { "name": "my-feature", "path": "/path/to/worktree" },
    "outputStyle": "default",
    "sessionName": "My Session"
  }
}
```

## Best Practices

1. **Always check for null** - Many fields can be null/undefined
2. **Use optional chaining** - `input.extensions?.renderWidthChars`
3. **Provide defaults** - Formatter handles missing data gracefully
4. **Extend via extensions** - Don't modify core interfaces for agent-specific data