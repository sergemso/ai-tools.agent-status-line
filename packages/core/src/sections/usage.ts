/**
 * Usage section - displays token usage details.
 * Priority: MEDIUM (30)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Usage section ID */
export const USAGE_SECTION_ID = "usage";

/** Create usage section items from unified input */
function createUsageItems(input: any): SectionItem[] {
  const usage = input.usage;
  if (!usage) return [];

  const items: SectionItem[] = [];

  // Total tokens - MEDIUM
  if (usage.totalTokens !== undefined) {
    items.push({
      id: "tokens",
      content: (ctx: RenderContext) => formatTokens(ctx.input.usage.totalTokens),
      priority: P.MEDIUM,
      minWidth: 4,
      idealWidth: 12,
      hints: { truncatable: false },
    });
  }

  // Cache tokens - LOW
  if (usage.cacheTokens !== undefined) {
    items.push({
      id: "cacheTokens",
      content: (ctx: RenderContext) => `cache: ${formatTokens(ctx.input.usage.cacheTokens)}`,
      priority: P.LOW,
      minWidth: 8,
      idealWidth: 16,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Format token count */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

/** Usage section definition */
export const usageSection: Section = {
  id: USAGE_SECTION_ID,
  name: "Usage",
  priority: P.MEDIUM,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.usage,
  minItems: 0,
};

/** Factory function to create usage section with items for a specific context */
export function createUsageSection(ctx: RenderContext): Section {
  return {
    ...usageSection,
    items: createUsageItems(ctx.input),
  };
}