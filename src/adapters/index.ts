// Adapter barrel exports

export type { StatusLineAdapter, AgentInput } from "./adapter.js";
export { AdapterRegistry, adapterRegistry, createCanHandle } from "./adapter.js";
export { ClaudeCodeAdapter, claudeCodeAdapter } from "./claude-code.js";
export { CursorAdapter, cursorAdapter } from "./cursor.js";

// Re-export unified model types
export type { 
  UnifiedStatusInput,
  UnifiedModelInfo,
  UnifiedContext,
  UnifiedUsage,
  UnifiedCost,
  UnifiedCache,
  RateLimitWindow,
  UnifiedExtensions,
  AgentType,
  ModelCapabilities,
} from "shared/unified-model.js";

// Auto-register default adapters
import { adapterRegistry } from "./adapter.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { cursorAdapter } from "./cursor.js";

// Register in priority order (more specific first)
adapterRegistry.register(cursorAdapter);    // Check first (more specific fields)
adapterRegistry.register(claudeCodeAdapter); // Fallback