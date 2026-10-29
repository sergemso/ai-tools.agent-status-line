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

  // Model name + effort combined - CRITICAL
  // Legacy: `${cyan(modelDisplay)}${effortDisplay ? ` ${effortDisplay}` : ""}`
  if (model.name) {
    items.push({
      id: "name",
      content: (ctx: RenderContext) => renderModelName(ctx.input.model),
      priority: P.CRITICAL,
      minWidth: 3,
      idealWidth: 30,
      hints: { truncatable: true, truncateSuffix: "…" },
    });
  }

  // Cost multiplier - LOW
  if (model.costMultiplier !== undefined && model.costMultiplier !== 1 && model.costMultiplier !== null) {
    items.push({
      id: "costMultiplier",
      content: (ctx: RenderContext) => `\x1b[36m${model.name}\x1b[0m \x1b[2mx${model.costMultiplier.toFixed(1).replace(/\.0$/, "")}\x1b[0m`,
      priority: P.LOW,
      minWidth: 6,
      idealWidth: 12,
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

/** Render model name with effort level - matches legacy formatter */
function renderModelName(model: any): string {
  const RESET = "\x1b[0m";
  const CYAN = "\x1b[36m";
  const DIM = "\x1b[2m";
  const GREEN = "\x1b[32m";
  const YELLOW = "\x1b[33m";
  const RED = "\x1b[31m";

  let modelDisplay = `${CYAN}${model.name}${RESET}`;
  const effortLevel = model.effort;
  
  let effortDisplay = "";
  switch (effortLevel) {
    case "low":
      effortDisplay = `${DIM}lo${RESET}`;
      break;
    case "medium":
      effortDisplay = `${GREEN}med${RESET}`;
      break;
    case "high":
      effortDisplay = `${YELLOW}hi${RESET}`;
      break;
    case "xhigh":
      effortDisplay = `${RED}xhi${RESET}`;
      break;
    case "max":
      effortDisplay = `${RED}max${RESET}`;
      break;
    default:
      if (effortLevel) effortDisplay = `${DIM}${effortLevel}${RESET}`;
  }

  return `${modelDisplay}${effortDisplay ? ` ${effortDisplay}` : ""}`;
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
  const model = ctx.input.model;
  if (!model) return { ...modelSection, items: [] };

  const items: SectionItem[] = [];

  // Model name + effort combined - CRITICAL
  if (model.name) {
    items.push({
      id: "name",
      content: (ctx: RenderContext) => renderModelName(ctx.input.model),
      priority: P.CRITICAL,
      minWidth: 3,
      idealWidth: 30,
      hints: { truncatable: true, truncateSuffix: "…" },
    });
  }

  // Cost multiplier - LOW
  if (model.costMultiplier !== undefined && model.costMultiplier !== 1 && model.costMultiplier !== null) {
    items.push({
      id: "costMultiplier",
      content: (ctx: RenderContext) => `\x1b[36m${model.name}\x1b[0m \x1b[2mx${model.costMultiplier.toFixed(1).replace(/\.0$/, "")}\x1b[0m`,
      priority: P.LOW,
      minWidth: 6,
      idealWidth: 12,
      hints: { truncatable: false },
    });
  }

  // Model ID - NONE (debug only) - only include if explicitly enabled via config
  // Not included by default

  return {
    ...modelSection,
    items,
  };
}