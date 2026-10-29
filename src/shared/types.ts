// TypeScript interfaces for the JSON input from Claude Code

export interface RateLimitWindow {
  used_percentage?: number;
  resets_at: number;
  period?: string;
}

export interface RateLimits {
  [key: string]: RateLimitWindow;
}

export interface ContextWindow {
  used_percentage?: number;
  context_window_size?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
}

export interface Cost {
  total_cost_usd?: number;
}

export interface PromptCache {
  ttl?: number;
  warm?: boolean;
  expires_at?: number;
  requests?: number;
  hit_ratio?: number;
  recache_tokens_if_cold?: number;
}

export interface ModelInfo {
  display_name: string;
}

export interface Effort {
  level?: string;
}

export interface StatusLineInput {
  model: ModelInfo;
  context_window: ContextWindow;
  cost: Cost;
  prompt_cache: PromptCache;
  rate_limits?: RateLimits;
  fast_mode?: boolean;
  effort?: Effort;
}

export interface PriceEntry {
  in: number;
  out: number;
  fast_in?: number;
}

export interface PriceTable {
  models: Record<string, PriceEntry>;
}

export interface ConfigSettings {
  BASE_MODEL?: string;
  SECTIONS?: string;
  RESETS?: string;
  PRICES_TTL?: string;
  CONTEXT_WARN?: string;
  CONTEXT_CRIT?: string;
  CACHE_WARN?: string;
  CACHE_CRIT?: string;
  RESET_WARN?: string;
  RESET_CRIT?: string;
  WIDTH?: string;
  MARGIN?: string;
  FORMAT?: string;
  EMOJI_WIDTH?: string;
  FORMATS?: string;
  DUMP?: string;
  FRESH_TOKENS?: string;
  SUMMARY_TOKENS?: string;
  OVERHEAD_WARN?: string;
  OVERHEAD_CRIT?: string;
  [key: string]: string | undefined;
}

export interface ParsedRateLimitRow {
  key: string;
  alias: string;
  name: string;
  pct: string;
  resets_at: string;
  total: string;
}