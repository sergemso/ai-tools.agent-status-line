/**
 * Overhead section - displays cache recache overhead cost.
 * Priority: MEDIUM (30)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

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
      content: (ctx: RenderContext) => renderOverheadCost(ctx.input.overhead, ctx.config),
      priority: P.MEDIUM,
      minWidth: 8,
      idealWidth: 16,
      hints: { truncatable: false },
    });
  }

  // Break-even point - LOW
  if (overhead.breakEven !== undefined) {
    items.push({
      id: "breakEven",
      content: (ctx: RenderContext) => `\x1b[2mnew@${ctx.input.overhead.breakEven}\x1b[0m`,
      priority: P.LOW,
      minWidth: 6,
      idealWidth: 10,
      hints: { truncatable: false },
    });
  }

  // Compact cost - LOW (only shown when context is critical)
  if (overhead.compactCost !== undefined) {
    items.push({
      id: "compactCost",
      content: (ctx: RenderContext) => `\x1b[2mcompact ${formatOverheadCost(ctx.input.overhead.compactCost)}\x1b[0m`,
      priority: P.LOW,
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
      priority: P.HIGH,
      minWidth: 8,
      idealWidth: 14,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Render overhead cost with color based on threshold */
function renderOverheadCost(overhead: any, config?: any): string {
  const cost = overhead.costPerCall;
  const costCents = Math.round(cost * 100);

  const warn = config?.overheadWarn ?? OVERHEAD_WARN;
  const crit = config?.overheadCrit ?? OVERHEAD_CRIT;

  let color = "\x1b[32m"; // GREEN
  if (costCents >= crit) color = "\x1b[31m"; // RED
  else if (costCents >= warn) color = "\x1b[33m"; // YELLOW

  return `${color}+${formatOverheadCost(cost)}/call\x1b[0m`;
}

/** Format overhead cost as $X.XX */
function formatOverheadCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(4)}`;
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