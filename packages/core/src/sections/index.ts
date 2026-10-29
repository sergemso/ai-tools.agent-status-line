/**
 * Sections registry - exports all built-in sections and provides config integration.
 */

import type { Section, UserConfig, RenderContext, SectionItem } from "../model.js";
import { PriorityLevel, parsePriority } from "../priority.js";

// Section exports
export * from "./model.js";
export * from "./context.js";
export * from "./cost.js";
export * from "./cache.js";
export * from "./rate-limits.js";
export * from "./usage.js";
export * from "./vim.js";
export * from "./worktree.js";
export * from "./cursor-extensions.js";

// Import factory functions
import { createModelSection, modelSection } from "./model.js";
import { createContextSection, contextSection } from "./context.js";
import { createCostSection, costSection } from "./cost.js";
import { createCacheSection, cacheSection } from "./cache.js";
import { createRateLimitsSection, rateLimitsSection } from "./rate-limits.js";
import { createUsageSection, usageSection } from "./usage.js";
import { createVimSection, vimSection } from "./vim.js";
import { createWorktreeSection, worktreeSection } from "./worktree.js";
import { createCursorExtensionsSection, cursorExtensionsSection } from "./cursor-extensions.js";

/** Default sections in display order */
export const DEFAULT_SECTIONS: Section[] = [
  modelSection,
  contextSection,
  costSection,
  cacheSection,
  rateLimitsSection,
  usageSection,
  vimSection,
  worktreeSection,
  cursorExtensionsSection,
];

/** Map of section ID to factory function */
const SECTION_FACTORIES: Record<string, (ctx: RenderContext) => Section> = {
  model: createModelSection,
  context: createContextSection,
  cost: createCostSection,
  cache: createCacheSection,
  "rate-limits": createRateLimitsSection,
  usage: createUsageSection,
  vim: createVimSection,
  worktree: createWorktreeSection,
  "cursor-extensions": createCursorExtensionsSection,
};

/** Map of section ID to base section definition */
const SECTION_DEFINITIONS: Record<string, Section> = {
  model: modelSection,
  context: contextSection,
  cost: costSection,
  cache: cacheSection,
  "rate-limits": rateLimitsSection,
  usage: usageSection,
  vim: vimSection,
  worktree: worktreeSection,
  "cursor-extensions": cursorExtensionsSection,
};

/**
 * Get sections with user config applied.
 * Creates section instances with items for the given render context.
 */
export function getSections(config: UserConfig, ctx: RenderContext): Section[] {
  const result: Section[] = [];

  for (const baseSection of DEFAULT_SECTIONS) {
    const sectionConfig = config.sections?.[baseSection.id];
    
    // Check if section is disabled
    if (sectionConfig?.enabled === false) continue;

    // Get factory function
    const factory = SECTION_FACTORIES[baseSection.id];
    if (!factory) continue;

    // Create section with items for this context
    let section = factory(ctx);

    // Apply section-level config overrides
    if (sectionConfig) {
      if (sectionConfig.priority !== undefined) {
        section = { ...section, priority: parsePriority(sectionConfig.priority) };
      }
      if (sectionConfig.minItems !== undefined) {
        section = { ...section, minItems: sectionConfig.minItems };
      }
    }

    // Apply item-level config overrides
    const itemsConfig = config.items ?? {};
    section = {
      ...section,
      items: section.items.map((item) => {
        const itemConfig = itemsConfig[`${section.id}.${item.id}`] ?? itemsConfig[item.id];
        if (!itemConfig) return item;

        const overrides: Partial<SectionItem> = {};
        if (itemConfig.enabled === false) return null; // Will be filtered
        if (itemConfig.priority !== undefined) overrides.priority = parsePriority(itemConfig.priority);
        if (itemConfig.minWidth !== undefined) overrides.minWidth = itemConfig.minWidth;
        
        return { ...item, ...overrides };
      }).filter((item): item is SectionItem => item !== null),
    };

    // Apply global priority threshold
    if (config.priorityThreshold !== undefined) {
      section = {
        ...section,
        items: section.items.filter((item) => item.priority >= config.priorityThreshold!),
      };
    }

    // Skip sections with no visible items
    if (section.items.length === 0) continue;

    result.push(section);
  }

  return result;
}

/**
 * Get base section definitions (without items populated).
 * Useful for config UI/schema generation.
 */
export function getSectionDefinitions(): Section[] {
  return DEFAULT_SECTIONS.map((s) => ({ ...s }));
}