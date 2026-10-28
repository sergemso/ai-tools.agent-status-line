export declare const DEFAULT_BASE_MODEL = "Claude Sonnet 5.5";
export declare const DEFAULT_SECTIONS = "model,context,cost,overhead,cache,resets";
export declare const DEFAULT_RESETS = "5h,7d,spend";
export declare const DEFAULT_PRICES_TTL = 3600;
export declare const DEFAULT_CONTEXT_WARN = 50;
export declare const DEFAULT_CONTEXT_CRIT = 80;
export declare const DEFAULT_CACHE_WARN = 20;
export declare const DEFAULT_CACHE_CRIT = 5;
export declare const DEFAULT_RESET_WARN = 50;
export declare const DEFAULT_RESET_CRIT = 80;
export declare const DEFAULT_WIDTH = 0;
export declare const DEFAULT_MARGIN = 2;
export declare const DEFAULT_FRESH_TOKENS = 25000;
export declare const DEFAULT_SUMMARY_TOKENS = 8000;
export declare const DEFAULT_OVERHEAD_WARN = 5;
export declare const DEFAULT_OVERHEAD_CRIT = 20;
export declare const ALL_SECTIONS: readonly ["model", "context", "tokens", "cost", "overhead", "cache", "stats", "resets"];
export type SectionName = (typeof ALL_SECTIONS)[number];
export declare const PRICING_URL = "https://platform.claude.com/docs/en/about-claude/pricing.md";
export declare const RETRY_AFTER_FAILURE = 300;
export declare const LOCK_STALE_AFTER = 120;
export declare const DURATION_UNITS: readonly [{
    readonly unit: "mo";
    readonly seconds: 2592000;
}, {
    readonly unit: "d";
    readonly seconds: 86400;
}, {
    readonly unit: "h";
    readonly seconds: 3600;
}, {
    readonly unit: "m";
    readonly seconds: 60;
}, {
    readonly unit: "s";
    readonly seconds: 1;
}];
export declare const BLOCK_CHARS: string[];
export declare const LEFT_BORDER = "\u2595";
export declare const RIGHT_BORDER = "\u258F";
export declare const ALL_BLOCK_CHARS: string[];
export declare const WINDOW_ALIASES: Record<string, {
    alias: string;
    name: string;
    total: string;
}>;
//# sourceMappingURL=constants.d.ts.map