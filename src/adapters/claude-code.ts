// Claude Code adapter - Reference implementation

import { StatusLineAdapter, createCanHandle, AgentInput } from "./adapter.js";
import { UnifiedStatusInput, UnifiedModelInfo, UnifiedContext, UnifiedUsage, UnifiedCost, UnifiedCache, RateLimitWindow, UnifiedExtensions, AgentType } from "shared/unified-model.js";

interface ClaudeCodeInput {
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
  rate_limits?: Record<string, {
    used_percentage?: number;
    resets_at: number;
    period?: string;
  }>;
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
  [key: string]: unknown;
}

function isClaudeCodeInput(input: AgentInput): input is ClaudeCodeInput {
  return (
    input.hook_event_name === "Status" &&
    typeof input.session_id === "string" &&
    typeof input.model === "object" &&
    input.model !== null &&
    typeof (input.model as Record<string, unknown>).id === "string" &&
    typeof (input.model as Record<string, unknown>).display_name === "string" &&
    typeof input.context_window === "object" &&
    input.context_window !== null &&
    typeof input.cost === "object" &&
    input.cost !== null &&
    typeof input.prompt_cache === "object" &&
    input.prompt_cache !== null
  );
}

export class ClaudeCodeAdapter implements StatusLineAdapter {
  readonly agentType: AgentType = "claude-code";
  
  // Detection: hook_event_name === "Status" + prompt_cache + rate_limits
  readonly canHandle = createCanHandle({
    hook_event_name: (v) => v === "Status",
    prompt_cache: (v) => v !== null && typeof v === "object",
    rate_limits: (v) => v !== null && typeof v === "object",
  });
  
  parse(input: AgentInput): UnifiedStatusInput {
    if (!isClaudeCodeInput(input)) {
      throw new Error("Invalid Claude Code input format");
    }
    
    const timestamp = Date.now();
    
    // Model info
    const model: UnifiedModelInfo = {
      id: input.model.id,
      displayName: input.model.display_name,
      provider: "anthropic",
      capabilities: {
        effortLevel: input.effort?.level ?? undefined,
      },
    };
    
    // Context window
    const contextWindow = input.context_window;
    const totalInputTokens = contextWindow.total_input_tokens ?? 0;
    const totalOutputTokens = contextWindow.total_output_tokens ?? 0;
    const context: UnifiedContext = {
      usedTokens: totalInputTokens + totalOutputTokens,
      maxTokens: contextWindow.context_window_size ?? 0,
      usedPercentage: contextWindow.used_percentage ?? null,
    };
    
    // Usage
    const currentUsage = contextWindow.current_usage;
    const usage: UnifiedUsage = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: currentUsage?.cache_read_input_tokens ?? undefined,
      cacheWriteTokens: currentUsage?.cache_creation_input_tokens ?? undefined,
    };
    
    // Cost
    const cost: UnifiedCost = {
      sessionCostUsd: input.cost.total_cost_usd ?? null,
      totalCostUsd: input.cost.total_cost_usd, // same as session for now
      currency: "USD",
    };
    
    // Cache
    const promptCache = input.prompt_cache ?? {};
    const cache: UnifiedCache = {
      ttlSeconds: promptCache.ttl ?? null,
      warm: promptCache.warm ?? false,
      hitRatio: promptCache.hit_ratio ?? undefined,
      expiresAt: promptCache.expires_at ?? undefined,
      recacheTokensIfCold: promptCache.recache_tokens_if_cold ?? undefined,
    };
    
    // Rate limits
    const rateLimits: RateLimitWindow[] = this.parseRateLimits(input.rate_limits ?? {});
    
    // Extensions
    const extensions: UnifiedExtensions = {
      vimMode: input.vim?.mode,
      worktree: input.worktree ? {
        name: input.worktree.name,
        path: input.worktree.path,
        branch: input.worktree.branch,
      } : undefined,
      outputStyle: input.output_style?.name,
      fastMode: input.fast_mode,
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
  
  private parseRateLimits(rateLimits: Record<string, {
    used_percentage?: number;
    resets_at: number;
    period?: string;
  }>): RateLimitWindow[] {
    const rows: RateLimitWindow[] = [];
    const nums: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
      seven: 7, eight: 8, nine: 9, ten: 10, thirty: 30,
    };
    const unitMap: Record<string, string> = {
      hour: "h", day: "d", week: "w", month: "mo",
    };
    
    for (const [key, value] of Object.entries(rateLimits)) {
      if (!value || typeof value !== "object" || value.resets_at == null) continue;
      
      let id = "";
      let name = "";
      let period: RateLimitWindow["period"] = "custom";
      
      if (key === "spend_limit") {
        id = "spend";
        name = "Spend limit";
        const periodMap: Record<string, string> = { daily: "24h", weekly: "7d", monthly: "30d" };
        period = (value.period && periodMap[value.period]) as RateLimitWindow["period"] || "custom";
      } else {
        const match = key.match(/^([a-z]+)_(hour|day|week|month)(?:_(.+))?$/);
        if (match && nums[match[1]]) {
          const n = nums[match[1]];
          const u = unitMap[match[2]];
          id = `${n}${u}`;
          if (match[3]) {
            id += `-${match[3].replace(/_/g, "-")}`;
            name = match[3].replace(/_/g, " ");
          } else {
            name = id;
          }
          period = ({ h: "5h", d: "24h", w: "7d", mo: "30d" } as Record<string, RateLimitWindow["period"]>)[u] || "custom";
        } else {
          id = key;
          name = key;
        }
      }
      
      const usedPercentage = value.used_percentage != null ? Math.round(value.used_percentage) : null;
      
      rows.push({
        id,
        name,
        used: usedPercentage,
        limit: 100, // percentage-based, so limit is 100%
        usedPercentage,
        resetsAt: value.resets_at,
        period,
      });
    }
    
    return rows;
  }
  
  formatOutput(line: string, _extensions: UnifiedExtensions): string {
    // Claude Code doesn't need special formatting
    return line;
  }
}

// Export singleton instance
export const claudeCodeAdapter = new ClaudeCodeAdapter();