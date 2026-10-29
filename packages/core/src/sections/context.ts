/**
 * Context section - displays context usage (tokens, percentage, bar).
 * Priority: HIGH (70)
 */

import type { Section, SectionItem, RenderContext, Priority } from "../model.js";
import { PriorityLevel as P } from "../priority.js";
import { itemFormat } from "../format.js";

// Block characters for context bar (8 levels)
const BLOCK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const LEFT_BORDER = "▕";
const RIGHT_BORDER = "▏";

// Thresholds - match legacy defaults
const CONTEXT_WARN = 50;
const CONTEXT_CRIT = 80;

/** Context section ID */
export const CONTEXT_SECTION_ID = "context";

/** Create context section items from unified input */
function createContextItems(input: any): SectionItem[] {
  const context = input.context;
  if (!context) return [];

  const items: SectionItem[] = [];

  // Context bar with percentage and size - HIGH
  if (context.percentage !== undefined) {
    items.push({
      id: "bar",
      content: (ctx: RenderContext) => renderContextBar(ctx.input.context, ctx.config, itemFormat(ctx, "context", "bar") === "ascii"),
      priority: 60 as Priority,
      minWidth: 10,
      idealWidth: 20,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Render a visual context bar with percentage and size - matches legacy formatter */
function renderContextBar(context: any, config?: any, ascii = false): string {
  const pct = Math.min(100, Math.max(0, context.percentage ?? 0));
  const width = 8; // 8 block characters
  const blockIdx = Math.min(Math.floor(pct / 12.5), 7);
  const fill = BLOCK_CHARS[blockIdx];

  // Determine color based on threshold (matching legacy)
  const warn = config?.contextWarn ?? CONTEXT_WARN;
  const crit = config?.contextCrit ?? CONTEXT_CRIT;
  let color = "\x1b[32m"; // GREEN
  if (pct >= crit) color = "\x1b[31m"; // RED
  else if (pct >= warn) color = "\x1b[33m"; // YELLOW

  const RESET = "\x1b[0m";
  const cells = Math.round((pct / 100) * 4);
  const ctxChar = ascii
    ? `${color}[${"#".repeat(cells)}${"-".repeat(4 - cells)}]${RESET}`
    : `${color}${LEFT_BORDER}${fill}${RIGHT_BORDER}${RESET}`;
  const ctxPct = `${color}${Math.round(pct)}%${RESET}`;

  const sizeStr = context.tokensTotal
    ? `${"\x1b[2m"}/${formatNumber(context.tokensTotal)}${RESET}`
    : "";

  return `${ctxChar} ${ctxPct}${sizeStr}`;
}

/** Format number with k/M suffix */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return Math.floor(n / 1_000_000) + "M";
  if (n >= 1_000) return Math.floor(n / 1_000) + "k";
  return String(n);
}

/** Context section definition */
export const contextSection: Section = {
  id: CONTEXT_SECTION_ID,
  name: "Context",
  priority: P.HIGH,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.context,
  minItems: 1,
};

/** Factory function to create context section with items for a specific context */
export function createContextSection(ctx: RenderContext): Section {
  return {
    ...contextSection,
    items: createContextItems(ctx.input),
  };
}