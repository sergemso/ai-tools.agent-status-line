/**
 * Cost section - displays session and total costs.
 * Priority: HIGH (70)
 */

import type { Section, SectionItem, RenderContext, Priority } from "../model.js";
import { PriorityLevel as P } from "../priority.js";
import { itemFormat, asciiCost } from "../format.js";

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
      content: (ctx: RenderContext) =>
        ({
          words: `session ${formatCost(ctx.input.cost.session)}`,
          short: `${formatCost(ctx.input.cost.session)} total`,
          glyph: `Σ ${formatCost(ctx.input.cost.session)}`,
          ascii: `${asciiCost(formatCost(ctx.input.cost.session))} tot`,
        })[itemFormat(ctx, "cost", "session")],
      priority: 50 as Priority,
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

/** Format cost as $X.XX (or $X.XXXX for sub-cent values). */
function formatCost(cost: number): string {
  if (cost >= 9.95) return `$${Math.round(cost)}`;
  if (cost >= 0.995) return `$${cost.toFixed(1).replace(/\.0$/, "")}`;
  if (cost >= 0.005) return `${Math.round(cost * 100)}¢`;
  return cost > 0 ? "<1¢" : "0¢";
}