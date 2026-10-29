// Unified internal data model for multi-agent status line support

export type AgentType = "claude-code" | "cursor";

export interface ModelCapabilities {
  paramSummary?: string;     // e.g., "(Thinking)" - Cursor
  maxMode?: boolean;         // e.g., true for max mode - Cursor
  effortLevel?: string;      // e.g., "low", "medium", "high" - Claude Code
  [key: string]: unknown;    // Allow future extensions
}

export interface UnifiedModelInfo {
  id: string;                // e.g., "claude-3-5-sonnet-20241022"
  displayName: string;       // e.g., "Claude Sonnet 5.5"
  provider: string;          // "anthropic", "openai", etc.
  capabilities: ModelCapabilities;
}

export interface UnifiedContext {
  usedTokens: number;
  maxTokens: number;
  usedPercentage: number | null;
}

export interface UnifiedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface UnifiedCost {
  sessionCostUsd: number | null;
  totalCostUsd?: number;     // lifetime if available
  currency: "USD";
}

export interface UnifiedCache {
  ttlSeconds: number | null;
  warm: boolean;
  hitRatio?: number;
  expiresAt?: number;
  recacheTokensIfCold?: number;
  /** API requests made so far in the session (for per-call context growth) */
  requests?: number;
}

export interface RateLimitWindow {
  id: string;                // e.g., "5h", "7d", "monthly"
  name: string;              // display name
  used: number | null;       // used percentage (null if unknown)
  limit: number | null;      // limit value
  usedPercentage: number | null;
  resetsAt: number;          // unix timestamp
  period: "5h" | "24h" | "7d" | "30d" | "custom";
}

export interface UnifiedExtensions {
  // Cursor-specific
  renderWidthChars?: number;
  autorun?: boolean;
  paramSummary?: string;
  maxMode?: boolean;
  
  // Shared
  vimMode?: "NORMAL" | "INSERT";
  worktree?: { name: string; path: string; branch?: string };
  outputStyle?: string;
  
  // Allow arbitrary extensions
  [key: string]: unknown;
}

export interface UnifiedStatusInput {
  // Core identification
  agent: AgentType;
  sessionId: string;
  timestamp: number;
  
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

// Type guard for checking if input is a valid UnifiedStatusInput
export function isUnifiedStatusInput(input: unknown): input is UnifiedStatusInput {
  if (!input || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  
  return (
    typeof obj.agent === "string" &&
    ["claude-code", "cursor"].includes(obj.agent) &&
    typeof obj.sessionId === "string" &&
    typeof obj.timestamp === "number" &&
    obj.model !== null && typeof obj.model === "object" &&
    obj.context !== null && typeof obj.context === "object" &&
    obj.usage !== null && typeof obj.usage === "object" &&
    obj.cost !== null && typeof obj.cost === "object" &&
    obj.cache !== null && typeof obj.cache === "object" &&
    Array.isArray(obj.rateLimits) &&
    obj.extensions !== null && typeof obj.extensions === "object"
  );
}