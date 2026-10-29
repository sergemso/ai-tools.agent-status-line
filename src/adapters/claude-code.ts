// Claude Code adapter - Reference implementation

import { StatusLineAdapter, createCanHandle, AgentInput } from "./adapter.js";
import { promises as fs, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
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
    ttl?: number | string; // seconds, or "5m" / "1h" as sent by newer Claude Code
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
    typeof input.session_id === "string" &&
    typeof input.model === "object" &&
    input.model !== null &&
    typeof (input.model as Record<string, unknown>).id === "string" &&
    typeof (input.model as Record<string, unknown>).display_name === "string" &&
    typeof input.context_window === "object" &&
    input.context_window !== null &&
    typeof input.cost === "object" &&
    input.cost !== null
  );
}

export class ClaudeCodeAdapter implements StatusLineAdapter {
  readonly agentType: AgentType = "claude-code";
  
  // Detection: session_id + transcript_path + context_window (hook_event_name and rate_limits are not always sent)
  readonly canHandle = (input: unknown): boolean =>
    createCanHandle({
      session_id: (v) => typeof v === "string",
      transcript_path: (v) => typeof v === "string",
      context_window: (v) => v !== null && typeof v === "object",
    })(input) && !("render_width_chars" in (input as object)); // Cursor input also has these fields
  
  isInstalled(): boolean {
    return existsSync(join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "settings.json"));
  }

  sampleInput(): AgentInput {
    return {
      session_id: "sample",
      transcript_path: "sample",
      model: { id: "claude-sonnet-5-5", display_name: "Sonnet 5.5" },
      effort: { level: "medium" },
      context_window: { total_input_tokens: 180000, total_output_tokens: 800, context_window_size: 1000000, used_percentage: 18 },
      cost: { total_cost_usd: 0.31 },
      prompt_cache: { ttl: "1h", warm: true, hit_ratio: 0.97, expires_at: Math.floor(Date.now() / 1000) + 25 * 60, requests: 120, recache_tokens_if_cold: 180000 },
    };
  }

  /** Median starting context (first assistant message usage) over the newest session transcripts. */
  async measureBaseline(configDir: string, maxFiles = 8): Promise<{ tokens: number; samples: number } | null> {
    const root = join(configDir, "projects");
    const files: Array<{ path: string; mtime: number }> = [];
    try {
      for (const dir of await fs.readdir(root)) {
        let names: string[] = [];
        try { names = await fs.readdir(join(root, dir)); } catch { continue; }
        for (const n of names) {
          if (!n.endsWith(".jsonl")) continue;
          const path = join(root, dir, n);
          try { files.push({ path, mtime: (await fs.stat(path)).mtimeMs }); } catch { /* skip */ }
        }
      }
    } catch { return null; }

    const values: number[] = [];
    for (const f of files.sort((a, b) => b.mtime - a.mtime).slice(0, maxFiles * 3)) {
      if (values.length >= maxFiles) break;
      let text = "";
      try { text = await fs.readFile(f.path, "utf8"); } catch { continue; }
      for (const line of text.split("\n")) {
        if (!line.includes('"usage"')) continue;
        try {
          const o = JSON.parse(line);
          const u = o?.message?.usage;
          if (o?.type === "assistant" && u) {
            const total = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
            if (total >= 5000) values.push(total);
            break;
          }
        } catch { /* ignore */ }
      }
    }
    if (values.length === 0) return null;
    values.sort((a, b) => a - b);
    return { tokens: Math.round(values[Math.floor(values.length / 2)] / 100) * 100, samples: values.length };
  }

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
      ttlSeconds: parseTtl(promptCache.ttl),
      warm: promptCache.warm ?? false,
      hitRatio: promptCache.hit_ratio ?? undefined,
      expiresAt: promptCache.expires_at ?? undefined,
      recacheTokensIfCold: promptCache.recache_tokens_if_cold ?? undefined,
      requests: promptCache.requests ?? undefined,
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
/** TTL as seconds: accepts 3600, "3600", "1h", "5m". */
function parseTtl(ttl: number | string | undefined): number | null {
  if (typeof ttl === "number") return ttl;
  if (typeof ttl !== "string") return null;
  const m = ttl.trim().match(/^(\d+)\s*([smh]?)$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "h" ? 3600 : m[2] === "m" ? 60 : 1);
}
