/**
 * Cache section - displays cache status and hit ratio.
 * Priority: MEDIUM (30)
 */

import type { Section, SectionItem, RenderContext, Priority } from "../model.js";
import { PriorityLevel as P } from "../priority.js";
import { itemFormat, type ItemFormat } from "../format.js";

// Thresholds - match legacy defaults
const CACHE_WARN = 20; // minutes
const CACHE_CRIT = 5;  // minutes

/** Cache section ID */
export const CACHE_SECTION_ID = "cache";

/** Create cache section items from unified input */
function createCacheItems(input: any): SectionItem[] {
  const cache = input.cache;
  if (!cache) return [];

  const items: SectionItem[] = [];

  // Cache timer + hit ratio combined - MEDIUM (matches legacy which combines them)
  if (cache.status === "warm" && cache.expiresAt !== undefined) {
    items.push({
      id: "timer",
      content: (ctx: RenderContext) => renderCacheTimer(ctx.input.cache, ctx.config, itemFormat(ctx, "cache", "timer")),
      priority: 90 as Priority,
      minWidth: 4,
      idealWidth: 15,
      hints: { truncatable: false },
    });
  } else if (cache.status === "cold") {
    items.push({
      id: "cold",
      content: (ctx: RenderContext) => renderColdCache(ctx.input.cache, itemFormat(ctx, "cache", "cold")),
      priority: 90 as Priority,
      minWidth: 8,
      idealWidth: 15,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Render cache timer with color based on remaining time */
function renderCacheTimer(cache: any, config?: any, fmt: ItemFormat = "glyph"): string {
  const now = Math.floor(Date.now() / 1000);
  const rem = cache.expiresAt - now;
  if (rem <= 0) {
    // Match legacy: show "cold" when expired, with hit ratio
    return renderColdCache(cache, fmt);
  }

  const warn = (config?.cacheWarn ?? CACHE_WARN) * 60;
  const crit = (config?.cacheCrit ?? CACHE_CRIT) * 60;

  let color = "\x1b[32m"; // GREEN
  if (rem < crit) color = "\x1b[31m"; // RED
  else if (rem < warn) color = "\x1b[33m"; // YELLOW

  // Format duration - match legacy format (e.g., "1h20m", "5m", "30s")
  const remMinutes = rem >= 60 ? Math.floor(rem / 60) * 60 : rem;
  const formatted = formatDuration(remMinutes).replace(/ /g, "");

  // Include hit ratio if available (legacy combines them)
  let hitRatioStr = "";
  if (cache.hitRatio !== undefined && Math.round(cache.hitRatio * 100) < 80) {
    const pct = Math.round(cache.hitRatio * 100);
    const hrColor = pct < 80 ? "\x1b[31m" : "\x1b[32m";
    hitRatioStr = ` ${hrColor}${pct}%\x1b[0m`;
  }

  return `\x1b[2m${fmt === "glyph" ? "⏱" : "cache"}\x1b[0m ${color}${formatted}\x1b[0m${hitRatioStr}`;
}

/** Render cold cache with hit ratio */
function renderColdCache(cache: any, fmt: ItemFormat = "glyph"): string {
  let hitRatioStr = "";
  if (cache.hitRatio !== undefined && Math.round(cache.hitRatio * 100) < 80) {
    const pct = Math.round(cache.hitRatio * 100);
    const hrColor = pct < 80 ? "\x1b[31m" : "\x1b[32m";
    hitRatioStr = ` ${hrColor}${pct}%\x1b[0m`;
  }
  return `\x1b[31m${fmt === "glyph" ? "⏱" : "cache"} cold\x1b[0m${hitRatioStr}`;
}

/** Render hit ratio with color */
function renderHitRatio(cache: any): string {
  const pct = Math.round(cache.hitRatio * 100);
  const color = pct < 80 ? "\x1b[31m" : "\x1b[32m"; // RED if < 80%, GREEN otherwise
  return `${color}${pct}%\x1b[0m`;
}

/** Format duration in seconds to human readable (e.g., 1h20m, 5m, 30s) */
function formatDuration(seconds: number): string {
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

/** Cache section definition */
export const cacheSection: Section = {
  id: CACHE_SECTION_ID,
  name: "Cache",
  priority: P.MEDIUM,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.cache,
  minItems: 0,
};

/** Factory function to create cache section with items for a specific context */
export function createCacheSection(ctx: RenderContext): Section {
  return {
    ...cacheSection,
    items: createCacheItems(ctx.input),
  };
}