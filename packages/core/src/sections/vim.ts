/**
 * Vim section - displays vim mode.
 * Priority: LOW (10)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Vim section ID */
export const VIM_SECTION_ID = "vim";

/** Create vim section items from unified input */
function createVimItems(input: any): SectionItem[] {
  const vim = input.vim;
  if (!vim || !vim.mode) return [];

  const items: SectionItem[] = [];

  // Vim mode - LOW
  items.push({
    id: "mode",
    content: vim.mode,
    priority: P.LOW,
    minWidth: 2,
    idealWidth: 8,
    hints: { truncatable: false },
  });

  return items;
}

/** Vim section definition */
export const vimSection: Section = {
  id: VIM_SECTION_ID,
  name: "Vim",
  priority: P.LOW,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.vim?.mode,
  minItems: 0,
};

/** Factory function to create vim section with items for a specific context */
export function createVimSection(ctx: RenderContext): Section {
  return {
    ...vimSection,
    items: createVimItems(ctx.input),
  };
}