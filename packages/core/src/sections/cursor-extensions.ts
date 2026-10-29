/**
 * Cursor Extensions section - displays Cursor-specific extensions info.
 * Priority: LOW (10)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Cursor extensions section ID */
export const CURSOR_EXTENSIONS_SECTION_ID = "cursor-extensions";

/** Create cursor extensions section items from unified input */
function createCursorExtensionsItems(input: any): SectionItem[] {
  const extensions = input.cursorExtensions;
  if (!extensions) return [];

  const items: SectionItem[] = [];

  // Max mode - MEDIUM
  if (extensions.maxMode) {
    items.push({
      id: "maxMode",
      content: extensions.maxMode,
      priority: P.MEDIUM,
      minWidth: 3,
      idealWidth: 10,
      hints: { truncatable: false },
    });
  }

  // Parameter summary - LOW
  if (extensions.paramSummary) {
    items.push({
      id: "paramSummary",
      content: extensions.paramSummary,
      priority: P.LOW,
      minWidth: 5,
      idealWidth: 20,
      hints: { truncatable: true, truncateSuffix: "…" },
    });
  }

  // Autorun - LOW
  if (extensions.autorun !== undefined) {
    items.push({
      id: "autorun",
      content: extensions.autorun ? "autorun" : "",
      priority: P.LOW,
      minWidth: 0,
      idealWidth: 7,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Cursor extensions section definition */
export const cursorExtensionsSection: Section = {
  id: CURSOR_EXTENSIONS_SECTION_ID,
  name: "Cursor Extensions",
  priority: P.LOW,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.cursorExtensions,
  minItems: 0,
};

/** Factory function to create cursor extensions section with items for a specific context */
export function createCursorExtensionsSection(ctx: RenderContext): Section {
  return {
    ...cursorExtensionsSection,
    items: createCursorExtensionsItems(ctx.input),
  };
}