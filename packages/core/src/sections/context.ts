/**
 * Context section - displays context usage (tokens, percentage, bar).
 * Priority: HIGH (70)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Context section ID */
export const CONTEXT_SECTION_ID = "context";

/** Create context section items from unified input */
function createContextItems(input: any): SectionItem[] {
  const context = input.context;
  if (!context) return [];

  const items: SectionItem[] = [];

  // Context bar - HIGH
  if (context.percentage !== undefined) {
    items.push({
      id: "bar",
      content: (ctx: RenderContext) => renderContextBar(ctx.input.context),
      priority: P.HIGH,
      minWidth: 10,
      idealWidth: 20,
      hints: { truncatable: false },
    });
  }

  // Token count - MEDIUM
  if (context.tokensUsed !== undefined || context.tokensTotal !== undefined) {
    items.push({
      id: "tokens",
      content: (ctx: RenderContext) => renderTokenCount(ctx.input.context),
      priority: P.MEDIUM,
      minWidth: 5,
      idealWidth: 15,
      hints: { truncatable: false },
    });
  }

  // Percentage - MEDIUM
  if (context.percentage !== undefined) {
    items.push({
      id: "percentage",
      content: (ctx: RenderContext) => `${Math.round(ctx.input.context.percentage)}%`,
      priority: P.MEDIUM,
      minWidth: 3,
      idealWidth: 5,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Render a visual context bar */
function renderContextBar(context: any): string {
  const pct = Math.min(100, Math.max(0, context.percentage ?? 0));
  const width = 10;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

/** Render token count as "used/total" */
function renderTokenCount(context: any): string {
  const used = context.tokensUsed ?? 0;
  const total = context.tokensTotal ?? 0;
  if (total > 0) {
    return `${formatNumber(used)}/${formatNumber(total)}`;
  }
  return formatNumber(used);
}

/** Format number with k/M suffix */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
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