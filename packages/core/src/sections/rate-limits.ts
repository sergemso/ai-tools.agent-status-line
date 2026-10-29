/**
 * Rate Limits section - displays rate limit windows.
 * Priority: MEDIUM (30)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Rate limits section ID */
export const RATE_LIMITS_SECTION_ID = "rate-limits";

/** Create rate limits section items from unified input */
function createRateLimitsItems(input: any): SectionItem[] {
  const rateLimits = input.rateLimits;
  if (!rateLimits || !Array.isArray(rateLimits) || rateLimits.length === 0) {
    return [];
  }

  const items: SectionItem[] = [];

  for (const limit of rateLimits) {
    if (!limit.window || limit.remaining === undefined) continue;

    // Priority based on usage percentage - higher usage = higher priority
    const used = limit.limit - limit.remaining;
    const pct = limit.limit > 0 ? (used / limit.limit) * 100 : 0;
    const priority = pct >= 80 ? P.HIGH : pct >= 50 ? P.MEDIUM : P.LOW;

    items.push({
      id: `window-${limit.window}`,
      content: (ctx: RenderContext) => {
        const lim = ctx.input.rateLimits?.find((r: any) => r.window === limit.window);
        if (!lim) return "";
        const rem = lim.remaining;
        const lmt = lim.limit;
        return `${limit.window}: ${rem}/${lmt}`;
      },
      priority,
      minWidth: 8,
      idealWidth: 20,
      hints: { truncatable: true, truncateSuffix: "…" },
    });
  }

  return items;
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
    items: createRateLimitsItems(ctx.input),
  };
}