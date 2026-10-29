// Cursor adapter

import { StatusLineAdapter, createCanHandle, AgentInput } from "./adapter.js";
import { UnifiedStatusInput, UnifiedModelInfo, UnifiedContext, UnifiedUsage, UnifiedCost, UnifiedCache, RateLimitWindow, UnifiedExtensions, AgentType } from "shared/unified-model.js";

interface CursorInput {
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
  [key: string]: unknown;
}

function isCursorInput(input: AgentInput): input is CursorInput {
  return (
    typeof input.render_width_chars === "number" &&
    typeof input.autorun === "boolean" &&
    typeof input.model === "object" &&
    input.model !== null &&
    typeof (input.model as Record<string, unknown>).param_summary === "string" &&
    typeof input.session_id === "string" &&
    typeof input.context_window === "object" &&
    input.context_window !== null
  );
}

export class CursorAdapter implements StatusLineAdapter {
  readonly agentType: AgentType = "cursor";
  
  // Detection: render_width_chars (number) + autorun (boolean) + model.param_summary (string)
  readonly canHandle = createCanHandle({
    render_width_chars: (v) => typeof v === "number",
    autorun: (v) => typeof v === "boolean",
    model: (v) => v !== null && typeof v === "object" && 
      (v as Record<string, unknown>).param_summary !== undefined,
  });
  
  parse(input: AgentInput): UnifiedStatusInput {
    if (!isCursorInput(input)) {
      throw new Error("Invalid Cursor input format");
    }
    
    const timestamp = Date.now();
    
    // Model info
    const model: UnifiedModelInfo = {
      id: input.model.id,
      displayName: input.model.display_name,
      provider: "anthropic", // Cursor uses Anthropic models
      capabilities: {
        paramSummary: input.model.param_summary,
        maxMode: input.model.max_mode,
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
    
    // Usage - Cursor doesn't provide cache tokens
    const currentUsage = contextWindow.current_usage;
    const usage: UnifiedUsage = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      // Cursor doesn't expose cache tokens
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    };
    
    // Cost - Cursor doesn't provide cost tracking
    const cost: UnifiedCost = {
      sessionCostUsd: null,
      currency: "USD",
    };
    
    // Cache - Cursor doesn't provide cache info
    const cache: UnifiedCache = {
      ttlSeconds: null,
      warm: false,
      hitRatio: undefined,
      expiresAt: undefined,
      recacheTokensIfCold: undefined,
    };
    
    // Rate limits - Cursor doesn't provide rate limits
    const rateLimits: RateLimitWindow[] = [];
    
    // Extensions
    const extensions: UnifiedExtensions = {
      renderWidthChars: input.render_width_chars,
      autorun: input.autorun,
      paramSummary: input.model.param_summary,
      maxMode: input.model.max_mode,
      vimMode: input.vim?.mode,
      worktree: input.worktree ? {
        name: input.worktree.name,
        path: input.worktree.path,
      } : undefined,
      outputStyle: input.output_style?.name,
      sessionName: input.session_name,
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
  
  formatOutput(line: string, _extensions: UnifiedExtensions): string {
    // Cursor provides render_width_chars, which we could use for compaction
    // For now, just return the line as-is
    return line;
  }
}

export const cursorAdapter = new CursorAdapter();