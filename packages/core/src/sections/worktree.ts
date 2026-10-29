/**
 * Worktree section - displays git worktree name.
 * Priority: LOW (10)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Worktree section ID */
export const WORKTREE_SECTION_ID = "worktree";

/** Create worktree section items from unified input */
function createWorktreeItems(input: any): SectionItem[] {
  const worktree = input.worktree;
  if (!worktree || !worktree.name) return [];

  const items: SectionItem[] = [];

  // Worktree name - LOW
  items.push({
    id: "name",
    content: worktree.name,
    priority: P.LOW,
    minWidth: 3,
    idealWidth: 20,
    hints: { truncatable: true, truncateSuffix: "…" },
  });

  return items;
}

/** Worktree section definition */
export const worktreeSection: Section = {
  id: WORKTREE_SECTION_ID,
  name: "Worktree",
  priority: P.LOW,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.worktree?.name,
  minItems: 0,
};

/** Factory function to create worktree section with items for a specific context */
export function createWorktreeSection(ctx: RenderContext): Section {
  return {
    ...worktreeSection,
    items: createWorktreeItems(ctx.input),
  };
}