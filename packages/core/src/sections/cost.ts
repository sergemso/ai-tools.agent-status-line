/**
 * Cost section - displays session and total costs.
 * Priority: HIGH (70)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Cost section ID */
export const COST_SECTION_ID = "cost";

/** Cost section definition */
export const costSection: Section = {
  id: COST_SECTION_ID,
  name: "Cost",
  priority: P.HIGH,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.cost?.session,
  minItems: 1,
};

/** Factory function to create cost section with items for a specific context */
export function createCostSection(ctx: RenderContext): Section {
  const cost = ctx.input.cost;
  if (!cost) return { ...costSection, items: [] };

  const items: SectionItem[] = [];

  // Session cost - HIGH
  if (cost.session !== undefined) {
    items.push({
      id: "session",
      content: (ctx: RenderContext) => `${formatCost(ctx.input.cost.session)} \x1b[2msess\x1b[0m`,
      priority: P.HIGH,
      minWidth: 8,
      idealWidth: 12,
      hints: { truncatable: false },
    });
  }

  // Total cost - LOW - only include if explicitly enabled via config
  // Not included by default

  return {
    ...costSection,
    items,
  };
}

/** Format cost as $X.XX */
function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(4)}`;
}