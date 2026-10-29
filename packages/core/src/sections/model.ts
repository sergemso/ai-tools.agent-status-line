/**
 * Model section - displays model information.
 * Priority: CRITICAL (100)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Model section ID */
export const MODEL_SECTION_ID = "model";

/** Create model section items from unified input */
function createModelItems(input: any): SectionItem[] {
  const model = input.model;
  if (!model) return [];

  const items: SectionItem[] = [];

  // Model name - CRITICAL
  if (model.name) {
    items.push({
      id: "name",
      content: model.name,
      priority: P.CRITICAL,
      minWidth: 3,
      idealWidth: 20,
      hints: { truncatable: true, truncateSuffix: "…" },
    });
  }

  // Model effort/reasoning - MEDIUM
  if (model.effort) {
    items.push({
      id: "effort",
      content: model.effort,
      priority: P.MEDIUM,
      minWidth: 2,
      idealWidth: 8,
      hints: { truncatable: false },
    });
  }

  // Cost multiplier - LOW
  if (model.costMultiplier !== undefined && model.costMultiplier !== 1) {
    items.push({
      id: "costMultiplier",
      content: (ctx: RenderContext) => `${model.costMultiplier}x`,
      priority: P.LOW,
      minWidth: 3,
      idealWidth: 6,
      hints: { truncatable: false },
    });
  }

  // Model ID - NONE (debug only)
  if (model.id) {
    items.push({
      id: "id",
      content: model.id,
      priority: P.NONE,
      minWidth: 5,
      idealWidth: 30,
      hints: { truncatable: true, truncateSuffix: "…" },
    });
  }

  return items;
}

/** Model section definition */
export const modelSection: Section = {
  id: MODEL_SECTION_ID,
  name: "Model",
  priority: P.CRITICAL,
  items: [], // Populated dynamically
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.model,
  minItems: 1,
};

/** Factory function to create model section with items for a specific context */
export function createModelSection(ctx: RenderContext): Section {
  return {
    ...modelSection,
    items: createModelItems(ctx.input),
  };
}