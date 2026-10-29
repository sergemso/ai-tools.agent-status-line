# Adding New Agent Adapters

This guide explains how to add support for a new coding agent.

## Overview

The adapter architecture consists of:
1. **Adapter Interface** - `StatusLineAdapter` with `parse()`, `canHandle()`, and optional `formatOutput()`
2. **Adapter Registry** - Auto-detects and manages adapters
3. **Unified Model** - Internal data model all adapters convert to

## Step 1: Research the Agent's Input Format

Before implementing, document:
- Configuration mechanism (config file, env vars, CLI)
- Input JSON schema (fields, types, required vs optional)
- Output expectations (ANSI codes, length limits, refresh rate)
- Available data points (model, tokens, cost, cache, rate limits, etc.)

Create a JSON schema and example payloads in `docs/agent-input-formats.md`.

## Step 2: Create the Adapter

Create `src/adapters/<agent>.ts`:

```typescript
// <Agent> adapter
import { StatusLineAdapter, createCanHandle, AgentInput } from "./adapter.js";
import { UnifiedStatusInput, UnifiedModelInfo, UnifiedContext, UnifiedUsage, UnifiedCost, UnifiedCache, RateLimitWindow, UnifiedExtensions, AgentType } from "shared/unified-model.js";

// 1. Define the agent's input type
interface MyAgentInput {
  // Required fields for detection
  unique_field: string;
  session_id: string;
  // ... other fields
}

// 2. Type guard for validation
function isMyAgentInput(input: AgentInput): input is MyAgentInput {
  return (
    typeof input.unique_field === "string" &&
    typeof input.session_id === "string" &&
    // ... other checks
  );
}

// 3. Implement the adapter
export class MyAgentAdapter implements StatusLineAdapter {
  readonly agentType: AgentType = "my-agent"; // Must match AgentType in unified-model.ts
  
  // Detection: unique fields that identify this agent
  readonly canHandle = createCanHandle({
    unique_field: (v) => typeof v === "string",
    session_id: (v) => typeof v === "string",
  });
  
  parse(input: AgentInput): UnifiedStatusInput {
    if (!isMyAgentInput(input)) {
      throw new Error("Invalid <Agent> input format");
    }
    
    const timestamp = Date.now();
    
    // Map agent fields to unified model
    const model: UnifiedModelInfo = {
      id: input.model.id,
      displayName: input.model.display_name,
      provider: "provider-name",
      capabilities: {
        // Agent-specific capabilities
      },
    };
    
    const context: UnifiedContext = {
      usedTokens: input.context_window.used_tokens,
      maxTokens: input.context_window.max_tokens,
      usedPercentage: input.context_window.used_percentage ?? null,
    };
    
    const usage: UnifiedUsage = {
      inputTokens: input.context_window.input_tokens,
      outputTokens: input.context_window.output_tokens,
      cacheReadTokens: input.context_window.cache_read_tokens ?? undefined,
      cacheWriteTokens: input.context_window.cache_write_tokens ?? undefined,
    };
    
    const cost: UnifiedCost = {
      sessionCostUsd: input.cost?.total_usd ?? null,
      currency: "USD",
    };
    
    const cache: UnifiedCache = {
      ttlSeconds: input.prompt_cache?.ttl ?? null,
      warm: input.prompt_cache?.warm ?? false,
      hitRatio: input.prompt_cache?.hit_ratio,
      expiresAt: input.prompt_cache?.expires_at,
      recacheTokensIfCold: input.prompt_cache?.recache_tokens,
    };
    
    const rateLimits: RateLimitWindow[] = this.parseRateLimits(input.rate_limits ?? {});
    
    const extensions: UnifiedExtensions = {
      // Agent-specific extensions
      customField: input.custom_field,
    };
    
    return {
      agent: this.agentType,
      sessionId: input.session_id,
      timestamp,
      model,
      context,
      usage,
      cost,
      cache,
      rateLimits,
      extensions,
    };
  }
  
  private parseRateLimits(rateLimits: Record<string, any>): RateLimitWindow[] {
    // Parse rate limits similar to claude-code.ts
    const rows: RateLimitWindow[] = [];
    // ... implementation
    return rows;
  }
  
  // Optional: agent-specific output formatting
  formatOutput(line: string, _extensions: UnifiedExtensions): string {
    // e.g., different ANSI handling, width constraints
    return line;
  }
}

// Export singleton
export const myAgentAdapter = new MyAgentAdapter();
```

## Step 3: Register the Adapter

Update `src/adapters/index.ts`:

```typescript
export { MyAgentAdapter, myAgentAdapter } from "./my-agent.js";

// Add to AgentType in unified-model.ts first!
// Then register in priority order (more specific first):
adapterRegistry.register(myAgentAdapter);
adapterRegistry.register(cursorAdapter);
adapterRegistry.register(claudeCodeAdapter);
```

## Step 4: Update Unified Model Types

Update `src/shared/unified-model.ts`:

```typescript
export type AgentType = "claude-code" | "cursor" | "my-agent";

// Add agent-specific capabilities to ModelCapabilities
export interface ModelCapabilities {
  // ... existing
  myAgentFeature?: string;
}

// Add agent-specific extensions to UnifiedExtensions
export interface UnifiedExtensions {
  // ... existing
  myAgentCustomField?: string;
}
```

## Step 5: Create Test Fixtures

Create fixtures in `test/fixtures/<agent>/`:
- `basic.json` - Minimal valid payload
- `full.json` - All fields populated
- `high-context.json` - >80% context usage
- `medium-context.json` - 50-80% context usage
- `edge-empty.json` - Missing optional fields
- `edge-null.json` - Explicit null values

## Step 6: Write Tests

Add tests in `test/integration/adapter-registry.test.ts` and `test/adapters/adapter.test.ts`:

```typescript
describe("<Agent> Adapter", () => {
  const fixtures = ["basic", "full", "high-context", "medium-context", "edge-empty", "edge-null"];
  
  for (const fixtureName of fixtures) {
    test(`parses ${fixtureName} fixture correctly`, () => {
      const input = loadFixtureDirect("my-agent", fixtureName);
      const unified = adapterRegistry.parse(input, "my-agent");
      
      expect(unified).toBeDefined();
      expect(unified.agent).toBe("my-agent");
      assertValidUnified(unified);
    });
  }
  
  test("canHandle detects <Agent> input", () => {
    const adapter = adapterRegistry.get("my-agent");
    const input = loadFixtureDirect("my-agent", "basic");
    expect(adapter!.canHandle(input)).toBe(true);
  });
  
  test("canHandle rejects other agents", () => {
    const adapter = adapterRegistry.get("my-agent");
    const input = loadFixtureDirect("claude-code", "basic");
    expect(adapter!.canHandle(input)).toBe(false);
  });
});
```

## Step 7: Test Integration

Run the full test suite:
```bash
npm test
npm run checkpoint:phase3
```

## Step 8: Update Documentation

- Add agent to `docs/multi-agent.md`
- Add setup instructions to `docs/agent-setup.md`
- Add configuration options to `docs/configuration.md`

## Best Practices

### Detection Priority
Register more specific adapters first. The registry checks `canHandle()` in registration order.

### Graceful Degradation
Handle missing fields with null/undefined:
```typescript
usedPercentage: input.context_window.used_percentage ?? null,
cacheReadTokens: input.context_window.cache_read_tokens ?? undefined,
```

### Agent-Specific Extensions
Use the `extensions` field for agent-unique data:
```typescript
extensions: {
  renderWidthChars: input.render_width_chars,
  autorun: input.autorun,
  // ...
}
```

### Rate Limits
Parse rate limits into the standard `RateLimitWindow[]` format:
```typescript
interface RateLimitWindow {
  id: string;           // e.g., "5h", "7d"
  name: string;         // display name
  used: number | null;  // used percentage
  limit: number | null; // limit value
  usedPercentage: number | null;
  resetsAt: number;     // unix timestamp
  period: "5h" | "24h" | "7d" | "30d" | "custom";
}
```

## Example: Minimal Adapter

For agents with minimal data (like Cursor):

```typescript
// Only implements required unified fields
// Missing fields (cost, cache, rate limits) set to null/empty
const cost: UnifiedCost = { sessionCostUsd: null, currency: "USD" };
const cache: UnifiedCache = { ttlSeconds: null, warm: false };
const rateLimits: RateLimitWindow[] = [];
```

The formatter automatically hides sections with no data.