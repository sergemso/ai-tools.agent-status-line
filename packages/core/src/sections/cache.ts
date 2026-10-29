/**
 * Cache section - displays cache status and hit ratio.
 * Priority: MEDIUM (30)
 */

import type { Section, SectionItem, RenderContext } from "../model.js";
import { PriorityLevel as P } from "../priority.js";

/** Cache section ID */
export const CACHE_SECTION_ID = "cache";

/** Create cache section items from unified input */
function createCacheItems(input: any): SectionItem[] {
  const cache = input.cache;
  if (!cache) return [];

  const items: SectionItem[] = [];

  // Cache status - MEDIUM
  if (cache.status) {
    items.push({
      id: "status",
      content: cache.status,
      priority: P.MEDIUM,
      minWidth: 4,
      idealWidth: 8,
      hints: { truncatable: false },
    });
  }

  // Hit ratio - LOW
  if (cache.hitRatio !== undefined) {
    items.push({
      id: "hitRatio",
      content: (ctx: RenderContext) => `${Math.round(ctx.input.cache.hitRatio * 100)}%`,
      priority: P.LOW,
      minWidth: 3,
      idealWidth: 5,
      hints: { truncatable: false },
    });
  }

  return items;
}

/** Cache section definition */
export const cacheSection: Section = {
  id: CACHE_SECTION_ID,
  name: "Cache",
  priority: P.MEDIUM,
  items: [],
  visibleWhen: (ctx: RenderContext) => !!ctx.input?.cache,
  minItems: 0,
};

/** Factory function to create cache section with items for a specific context */
export function createCacheSection(ctx: RenderContext): Section {
  return {
    ...cacheSection,
    items: createCacheItems(ctx.input),
  };
}