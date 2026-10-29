/**
 * Configuration system for section-priority-based rendering.
 * Handles user config overrides for sections and items.
 */

import type { Section, UserConfig, SectionConfig, ItemConfig, Priority, SectionItem } from "./model.js";
import { parsePriority, PriorityLevel as P } from "./priority.js";
import { DEFAULT_CONFIG } from "./model.js";

/**
 * Apply user configuration to base sections.
 * Returns new sections array with config applied.
 */
export function applyConfig(baseSections: Section[], config: UserConfig): Section[] {
  const result: Section[] = [];
  
  for (const baseSection of baseSections) {
    const sectionConfig = config.sections?.[baseSection.id];
    
    // Check if section is disabled
    if (sectionConfig?.enabled === false) continue;
    
    // Create section with config overrides
    let section: Section = { ...baseSection };
    
    // Apply section-level config
    if (sectionConfig) {
      if (sectionConfig.priority !== undefined) {
        section = { ...section, priority: parsePriority(sectionConfig.priority) };
      }
      if (sectionConfig.minItems !== undefined) {
        section = { ...section, minItems: sectionConfig.minItems };
      }
    }
    
    // Apply item-level config
    const itemsConfig = config.items ?? {};
    section = {
      ...section,
      items: section.items.map((item) => {
        // Config key can be "sectionId.itemId" or just "itemId"
        const itemConfig = itemsConfig[`${section.id}.${item.id}`] ?? itemsConfig[item.id];
        if (!itemConfig) return item;
        
        // Check if item is disabled
        if (itemConfig.enabled === false) return null;
        
        const overrides: Partial<SectionItem> = {};
        if (itemConfig.priority !== undefined) overrides.priority = parsePriority(itemConfig.priority);
        if (itemConfig.minWidth !== undefined) overrides.minWidth = itemConfig.minWidth;
        
        return { ...item, ...overrides };
      }).filter((item): item is SectionItem => item !== null),
    };
    
    // Apply global priority threshold
    if (config.priorityThreshold !== undefined) {
      const threshold = parsePriority(config.priorityThreshold);
      section = {
        ...section,
        items: section.items.filter((item) => item.priority >= threshold),
      };
    }
    
    // Skip sections with no visible items
    if (section.items.length === 0) continue;
    
    result.push(section);
  }
  
  return result;
}

/**
 * Merge user config with defaults.
 */
export function mergeConfig(userConfig: Partial<UserConfig>): UserConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    sections: {
      ...DEFAULT_CONFIG.sections,
      ...userConfig.sections,
    },
    items: {
      ...DEFAULT_CONFIG.items,
      ...userConfig.items,
    },
  };
}

/**
 * Validate user config.
 * Returns array of validation errors (empty if valid).
 */
export function validateConfig(config: UserConfig): string[] {
  const errors: string[] = [];
  
  // Validate section configs
  if (config.sections) {
    for (const [sectionId, sectionConfig] of Object.entries(config.sections)) {
      if (sectionConfig.priority !== undefined) {
        // Check raw value before parsing
        const raw = sectionConfig.priority;
        if (typeof raw === "number" && (raw < 0 || raw > 100)) {
          errors.push(`Section "${sectionId}": priority must be 0-100`);
        }
      }
      if (sectionConfig.minItems !== undefined && sectionConfig.minItems < 0) {
        errors.push(`Section "${sectionId}": minItems must be >= 0`);
      }
    }
  }
  
  // Validate item configs
  if (config.items) {
    for (const [itemKey, itemConfig] of Object.entries(config.items)) {
      if (itemConfig.priority !== undefined) {
        const raw = itemConfig.priority;
        if (typeof raw === "number" && (raw < 0 || raw > 100)) {
          errors.push(`Item "${itemKey}": priority must be 0-100`);
        }
      }
      if (itemConfig.minWidth !== undefined && itemConfig.minWidth < 0) {
        errors.push(`Item "${itemKey}": minWidth must be >= 0`);
      }
    }
  }
  
  // Validate global priority threshold
  if (config.priorityThreshold !== undefined) {
    const raw = config.priorityThreshold;
    if (typeof raw === "number" && (raw < 0 || raw > 100)) {
      errors.push(`priorityThreshold must be 0-100`);
    }
  }
  
  return errors;
}

/**
 * Get default config schema for documentation/UI generation.
 */
export function getConfigSchema(): {
  sections: Record<string, { priority: Priority; minItems?: number }>;
  items: Record<string, { priority: Priority; minWidth?: number }>;
} {
  return {
    sections: {},
    items: {},
  };
}

// Re-export DEFAULT_CONFIG from model
export { DEFAULT_CONFIG } from "./model.js";