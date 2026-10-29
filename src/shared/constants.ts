// Shared constants and defaults

export const DEFAULT_BASE_MODEL = "Claude Sonnet 5.5";
export const DEFAULT_SECTIONS = "model,context,cost,overhead,cache,resets";
export const DEFAULT_RESETS = "5h,7d,spend";
export const DEFAULT_PRICES_TTL = 3600;
export const DEFAULT_CONTEXT_WARN = 50;
export const DEFAULT_CONTEXT_CRIT = 80;
export const DEFAULT_CACHE_WARN = 20;
export const DEFAULT_CACHE_CRIT = 5;
export const DEFAULT_RESET_WARN = 50;
export const DEFAULT_RESET_CRIT = 80;
export const DEFAULT_WIDTH = 0; // 0 = auto-detect
export const DEFAULT_MARGIN = 2;
export const DEFAULT_FRESH_TOKENS = 25000;
export const DEFAULT_SUMMARY_TOKENS = 8000;
export const DEFAULT_OVERHEAD_WARN = 5;
export const DEFAULT_OVERHEAD_CRIT = 20;

export const ALL_SECTIONS = [
  "model",
  "context",
  "tokens",
  "cost",
  "overhead",
  "cache",
  "stats",
  "resets",
] as const;

export type SectionName = (typeof ALL_SECTIONS)[number];

export const PRICING_URL = "https://platform.claude.com/docs/en/about-claude/pricing.md";
export const RETRY_AFTER_FAILURE = 300; // 5 minutes
export const LOCK_STALE_AFTER = 120; // 2 minutes

// Duration units for formatting
export const DURATION_UNITS = [
  { unit: "mo", seconds: 2592000 }, // 30 days
  { unit: "d", seconds: 86400 },
  { unit: "h", seconds: 3600 },
  { unit: "m", seconds: 60 },
  { unit: "s", seconds: 1 },
] as const;

// Block characters for context bar (8 levels)
export const BLOCK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
export const LEFT_BORDER = "▕";
export const RIGHT_BORDER = "▏";

// All block chars for visible width calculation
export const ALL_BLOCK_CHARS = [...BLOCK_CHARS, LEFT_BORDER, RIGHT_BORDER];

// Window name to display mapping
export const WINDOW_ALIASES: Record<string, { alias: string; name: string; total: string }> = {
  five_hour: { alias: "5h", name: "", total: "5h" },
  seven_day: { alias: "7d", name: "", total: "7d" },
  spend_limit: { alias: "spend", name: "", total: "" }, // total comes from period
};