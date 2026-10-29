/**
 * Cost section - displays session and total costs.
 * Priority: HIGH (70)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Cost section ID */
export const COST_SECTION_ID = "cost";

/** Create cost section items from unified input */
function createCostItems(input: any): SectionItem[] {
  const cost = input.cost;
  if (!cost) return [];

  const items: SectionItem[] = [];

  // Session cost - HIGH
  if (cost.session !== undefined) {
    items.push({
      id: "session",
      content: (ctx: RenderContext) => formatCost(ctx.input.cost.session),
      priority: P.HIGH,
      minWidth: 4,
      idealWidth: 10,
      hints: { truncatable: false },
    });
  }

  // Total cost - LOW
  if (cost.total !== undefined) {
    items.push({
      id: "total",
      content: (ctx: RenderContext) => formatCost(ctx.input.cost.total),
      priority: P.LOW,
      minWidth: 4,
      idealWidth: 10,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Format cost as $X.XX */
function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(4)}`;
}

/** Cost section definition */
export const costSection: Section = {
  id: COST_SECTION_ID,
  name: "Cost",
  priority: P.HIGH,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.cost,
  minItems: 1,
};

/** Factory function to create cost section with items for a specific context */
export function createCostSection(ctx: RenderContext): Section {
  return {
    ...costSection,
    items: createCostItems(ctx.input),
  };
}