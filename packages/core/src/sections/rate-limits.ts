/**
 * Rate Limits section - displays rate limit windows.
 * Priority: MEDIUM (30)
 */

import type { Section, SectionItem, RenderContext, UserConfig } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

// Window aliases matching legacy - keys are unified rate limit IDs from adapter
const WINDOW_ALIASES: Record<string, { alias: string; name: string; total: string }> = {
  "5h": { alias: "5h", name: "", total: "100" },
  "7d": { alias: "7d", name: "", total: "100" },
  spend: { alias: "spend", name: "Spend limit", total: "100" },
  "1d": { alias: "1d", name: "", total: "100" },
};

/** Rate limits section ID */
export const RATE_LIMITS_SECTION_ID = "rate-limits";

/** Create rate limits section items from unified input */
function createRateLimitsItems(input: any, config?: UserConfig): SectionItem[] {
  const rateLimits = input.rateLimits;
  if (!rateLimits || !Array.isArray(rateLimits) || rateLimits.length === 0) {
    return [];
  }

  // Filter by resets config if provided
  const resetsFilter = config?.sections?.["rate-limits"]?.resets;
  let filteredLimits = rateLimits;
  if (resetsFilter && Array.isArray(resetsFilter) && resetsFilter.length > 0) {
    filteredLimits = rateLimits.filter((r) => resetsFilter.includes(r.window));
  }

  const items: SectionItem[] = [];

  for (const limit of filteredLimits) {
    if (!limit.window || limit.remaining === undefined) continue;

    const alias = WINDOW_ALIASES[limit.window]?.alias ?? limit.window;
    const name = WINDOW_ALIASES[limit.window]?.name ?? "";
    const total = WINDOW_ALIASES[limit.window]?.total ?? "";

    // Priority based on usage percentage - higher usage = higher priority
    const used = limit.limit - limit.remaining;
    const pct = limit.limit > 0 ? (used / limit.limit) * 100 : 0;
    const priority = pct >= 80 ? P.HIGH : pct >= 50 ? P.MEDIUM : P.LOW;

    items.push({
      id: `window-${limit.window}`,
      content: (ctx: RenderContext) => renderRateLimit(limit, ctx.config),
      priority,
      minWidth: 8,
      idealWidth: 25,
      hints: { truncatable: true, truncateSuffix: "…" },
    });
  }

  return items;
}

/** Render a single rate limit window - matches legacy format */
function renderRateLimit(limit: any, config?: any): string {
  const alias = WINDOW_ALIASES[limit.window]?.alias ?? limit.window;
  const name = WINDOW_ALIASES[limit.window]?.name ?? "";

  const used = limit.limit - limit.remaining;
  const pct = limit.limit > 0 ? Math.round((used / limit.limit) * 100) : 0;
  const remaining = limit.remaining;
  const lmt = limit.limit;

  // Color for percentage
  const warn = config?.resetWarn ?? 50;
  const crit = config?.resetCrit ?? 80;
  let pctColor = "\x1b[32m"; // GREEN
  if (pct >= crit) pctColor = "\x1b[31m"; // RED
  else if (pct >= warn) pctColor = "\x1b[33m"; // YELLOW

  // Format time remaining
  const now = Math.floor(Date.now() / 1000);
  const resetsAt = limit.resetsAt ?? 0;
  const left = resetsAt - now;
  const timeLeft = formatDuration(left);

  // Total - use the limit value (legacy shows / 100 for percentage-based)
  const totPart = ` \x1b[2m/ ${lmt}\x1b[0m`;

  // Build parts
  let namePart = "";
  if (name) namePart = `\x1b[2m${name}\x1b[0m `;

  let pctPart = `${pctColor}${pct}%\x1b[0m `;

  return `${namePart}\x1b[2m${alias}\x1b[0m ${pctPart}${timeLeft}${totPart}`;
}

/** Format duration in seconds to human readable (e.g., 1h20m, 5m, 30s, 0s) */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds >= 86400) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d${hours > 0 ? hours + "h" : ""}`;
  }
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h${mins > 0 ? mins + "m" : ""}`;
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m${secs > 0 ? secs + "s" : ""}`;
  }
  return `${seconds}s`;
}

/** Rate limits section definition */
export const rateLimitsSection: Section = {
  id: RATE_LIMITS_SECTION_ID,
  name: "Rate Limits",
  priority: P.MEDIUM,
  items: [],
  visibleWhen: (ctx: RenderContext) => Array.isArray(ctx.input?.rateLimits) && ctx.input.rateLimits.length > 0,
  minItems: 0,
};

/** Factory function to create rate limits section with items for a specific context */
export function createRateLimitsSection(ctx: RenderContext): Section {
  return {
    ...rateLimitsSection,
    items: createRateLimitsItems(ctx.input, ctx.config),
  };
}