/**
 * Format seconds into two most significant units (mo/d/h/m/s)
 * Examples: "2mo 3d", "6d 23h", "5h 12m", "1d 0h", "42m 5s", "59s"
 */
export declare function fmtDur(seconds: number): string;
/**
 * Format token count: 245152 -> "245k", 1234567 -> "1.2M", 4200 -> "4.2k"
 */
export declare function fmtTok(n: number): string;
/**
 * Format money from dollars: 0.005 -> "<1¢", 0.42 -> "42¢", 5.60 -> "$5.60"
 * Input is in dollars (not cents)
 * Matches bash: c = x * 100; if (c < 1) "<1¢"; else if (c < 100) printf "%d¢", c + 0.5
 */
export declare function money(dollars: number): string;
/**
 * Parse a setting value as integer, with fallback to default
 */
export declare function parseIntSetting(value: string | undefined, defaultValue: number): number;
//# sourceMappingURL=formatting.d.ts.map