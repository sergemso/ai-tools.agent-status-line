// Formatting utilities: duration, tokens, money
import { DURATION_UNITS } from "./constants.js";
/**
 * Format seconds into two most significant units (mo/d/h/m/s)
 * Examples: "2mo 3d", "6d 23h", "5h 12m", "1d 0h", "42m 5s", "59s"
 */
export function fmtDur(seconds) {
    let s = Math.max(0, Math.floor(seconds));
    let out = "";
    let parts = 0;
    let started = false;
    for (const { unit, seconds: unitSecs } of DURATION_UNITS) {
        const n = Math.floor(s / unitSecs);
        s = s % unitSecs;
        if (started || n > 0) {
            started = true;
            parts++;
            out += (out ? " " : "") + n + unit;
            if (parts >= 2)
                break;
        }
    }
    return out || "0s";
}
/**
 * Format token count: 245152 -> "245k", 1234567 -> "1.2M", 4200 -> "4.2k"
 */
export function fmtTok(n) {
    if (n >= 1000000) {
        return `${Math.floor(n / 1000000)}.${Math.floor((n % 1000000) / 100000)}M`;
    }
    if (n >= 10000) {
        return `${Math.floor(n / 1000)}k`;
    }
    if (n >= 1000) {
        return `${Math.floor(n / 1000)}.${Math.floor((n % 1000) / 100)}k`;
    }
    return String(n);
}
/**
 * Format money from dollars: 0.005 -> "<1¢", 0.42 -> "42¢", 5.60 -> "$5.60"
 * Input is in dollars (not cents)
 * Matches bash: c = x * 100; if (c < 1) "<1¢"; else if (c < 100) printf "%d¢", c + 0.5
 */
export function money(dollars) {
    const c = dollars * 100;
    if (c < 1)
        return "<1¢";
    if (c < 100)
        return `${Math.round(c)}¢`;
    return `$${dollars.toFixed(2)}`;
}
/**
 * Parse a setting value as integer, with fallback to default
 */
export function parseIntSetting(value, defaultValue) {
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
//# sourceMappingURL=formatting.js.map