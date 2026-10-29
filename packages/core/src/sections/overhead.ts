/**
 * Overhead section - displays cache recache overhead cost.
 * Priority: MEDIUM (30)
 */

import type { Section, SectionItem, RenderContext, Priority } from "../model.js";
import { PriorityLevel as P } from "../priority.js";
import { itemFormat, asciiCost, type ItemFormat } from "../format.js";

// Thresholds - match legacy defaults
const OVERHEAD_WARN = 5;  // cents
const OVERHEAD_CRIT = 20; // cents
const DEFAULT_FRESH_TOKENS = 25000;

/** Overhead section ID */
export const OVERHEAD_SECTION_ID = "overhead";

/** Create overhead section items from unified input */
function createOverheadItems(input: any): SectionItem[] {
  const overhead = input.overhead;
  if (!overhead) return [];

  const items: SectionItem[] = [];

  // Only show overhead if there's data (matches legacy: ctoks > freshTokens)
  if (!overhead.show) {
    return [];
  }

  // Overhead cost per call - MEDIUM
  if (overhead.costPerCall !== undefined) {
    items.push({
      id: "costPerCall",
      content: (ctx: RenderContext) => renderOverheadCost(ctx.input.overhead, ctx.config, itemFormat(ctx, "overhead", "costPerCall")),
      priority: 80 as Priority,
      minWidth: 8,
      idealWidth: 16,
      hints: { truncatable: false },
    });
  }

  // Break-even point - LOW
  if (hasThreshold(overhead.breakEven)) {
    items.push({
      id: "breakEven",
      content: (ctx: RenderContext) => renderHorizons(ctx.input.overhead.breakEven, itemFormat(ctx, "overhead", "breakEven")),
      priority: 70 as Priority,
      minWidth: 6,
      idealWidth: 10,
      hints: { truncatable: false },
    });
  }

  // Compact cost - LOW (only shown when context is critical)
  if (overhead.compactCost !== undefined) {
    items.push({
      id: "compactCost",
      content: (ctx: RenderContext) => `\x1b[2m${{ words: "compact cost", short: "compact", glyph: "⇲", ascii: "cmp" }[itemFormat(ctx, "overhead", "compactCost")]} ${itemFormat(ctx, "overhead", "compactCost") === "ascii" ? asciiCost(formatOverheadCost(ctx.input.overhead.compactCost)) : formatOverheadCost(ctx.input.overhead.compactCost)}\x1b[0m`,
      priority: 30 as Priority,
      minWidth: 10,
      idealWidth: 18,
      hints: { truncatable: false },
    });
  }

  // Cold cache indicator - HIGH (when cold)
  if (overhead.isCold && overhead.coldCost !== undefined) {
    items.push({
      id: "cold",
      content: (ctx: RenderContext) => `\x1b[31mcold +${formatOverheadCost(ctx.input.overhead.coldCost)}\x1b[0m`,
      priority: 90 as Priority,
      minWidth: 8,
      idealWidth: 14,
      hints: { truncatable: false },
    });
  }

  return items;
}

/**
 * Expected-call counts at which the colour changes: yellow from `yellowFrom` (restart within 30% of
 * staying), red from `redFrom` (restart cheaper). Green needs no number; nothing to show if neither exists.
 */
function renderHorizons(be: { yellowFrom: number; redFrom: number }, fmt: ItemFormat = "glyph"): string {
  const ok = (n: number) => Number.isFinite(n) && n <= 99;
  const parts: string[] = [];
  if (ok(be.yellowFrom) && be.yellowFrom < be.redFrom) parts.push(`\x1b[1;33m${be.yellowFrom}\x1b[0m`);
  if (ok(be.redFrom)) parts.push(`\x1b[1;31m${be.redFrom}\x1b[0m`);
  if (fmt === "ascii") {
    return `\x1b[2mrst\x1b[0m ${parts.join(" ")}`;
  }
  if (fmt === "short") {
    return `\x1b[2mrestart\x1b[0m ${parts.join("\x1b[2m–\x1b[0m")}`;
  }
  if (fmt === "words") {
    const y = ok(be.yellowFrom) && be.yellowFrom < be.redFrom ? `maybe at \x1b[1;33m${be.yellowFrom}\x1b[0m` : "";
    const r = ok(be.redFrom) ? `yes at \x1b[1;31m${be.redFrom}\x1b[0m` : "";
    return `\x1b[2mrestart:\x1b[0m ${[y, r].filter(Boolean).join(", ")} \x1b[2mcalls\x1b[0m`;
  }
  return `\x1b[2m⟲\x1b[0m ${parts.join(" ")}`;
}

/** True when there is at least one threshold worth showing */
function hasThreshold(be: any): boolean {
  return !!be && [be.yellowFrom, be.redFrom].some((n: number) => Number.isFinite(n) && n <= 99);
}

/** Render overhead cost with color based on threshold */
function renderOverheadCost(overhead: any, config?: any, fmt: ItemFormat = "glyph"): string {
  const cost = overhead.costPerCall;
  const costCents = Math.round(cost * 100);

  const warn = config?.overheadWarn ?? OVERHEAD_WARN;
  const crit = config?.overheadCrit ?? OVERHEAD_CRIT;

  let color = "\x1b[32m"; // GREEN
  if (costCents >= crit) color = "\x1b[31m"; // RED
  else if (costCents >= warn) color = "\x1b[33m"; // YELLOW

  return `${color}${{ words: "next call ", short: "next ", glyph: "⚡", ascii: "nx " }[fmt]}${fmt === "ascii" ? asciiCost(formatOverheadCost(cost)) : formatOverheadCost(cost)}\x1b[0m`;
}

/** Format overhead cost as $X.XX */
function formatOverheadCost(cost: number): string {
  if (cost >= 9.95) return `$${Math.round(cost)}`;
  if (cost >= 0.995) return `$${cost.toFixed(1).replace(/\.0$/, "")}`;
  if (cost >= 0.095) return `${Math.round(cost * 100)}¢`;
  if (cost >= 0.0005) return `${(cost * 100).toFixed(1)}¢`;
  return cost > 0 ? "<.1¢" : "0¢";
}

/** Overhead section definition */
export const overheadSection: Section = {
  id: OVERHEAD_SECTION_ID,
  name: "Overhead",
  priority: P.MEDIUM,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.overhead?.show,
  minItems: 0,
};

/** Factory function to create overhead section with items for a specific context */
export function createOverheadSection(ctx: RenderContext): Section {
  return {
    ...overheadSection,
    items: createOverheadItems(ctx.input),
  };
}