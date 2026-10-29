/**
 * New formatter using section-priority-based rendering from @statusline/core.
 * This replaces the legacy formatter.ts with the new pipeline.
 */

import { formatStatusLine as legacyFormatStatusLine } from "./formatter.js";
import type { FormatterOptions } from "./formatter.js";
import type { UnifiedStatusInput } from "./adapters/index.js";

import {
  buildLayout,
  estimateWidth,
  getSections,
  getRenderer,
  type Section,
  type RenderContext,
  type UserConfig,
  PriorityLevel as P,
} from "@statusline/core";
import { cliRenderer } from "@statusline/core";

/**
 * Convert unified input to the format expected by core sections.
 * This adapts the existing UnifiedStatusInput to the section item generators.
 */
function adaptInputForCore(unified: UnifiedStatusInput): any {
  const { model, context, usage, cost, cache, rateLimits, vim, worktree, extensions } = unified;
  
  return {
    model: {
      name: model.displayName,
      effort: model.capabilities.effortLevel,
      costMultiplier: matchModelPriceForCore(model.displayName, extensions.fastMode === true),
      id: model.id,
    },
    context: {
      percentage: context.usedPercentage,
      tokensUsed: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      tokensTotal: context.maxTokens,
    },
    cost: {
      session: cost.sessionCostUsd,
      total: cost.totalCostUsd,
    },
    cache: cache.ttlSeconds !== null ? {
      status: cache.warm ? "warm" : "cold",
      hitRatio: cache.hitRatio,
    } : null,
    rateLimits: rateLimits.map((r) => ({
      window: r.id,
      limit: r.limit,
      remaining: r.limit !== null ? r.limit - (r.limit * (r.usedPercentage ?? 0) / 100) : 0,
    })),
    usage: {
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      cacheTokens: cache.recacheTokensIfCold,
    },
    vim: vim ? { mode: vim.mode } : null,
    worktree: worktree ? { name: worktree.name } : null,
    cursorExtensions: extensions ? {
      maxMode: extensions.maxMode,
      paramSummary: extensions.paramSummary,
      autorun: extensions.autorun,
    } : null,
  };
}

// Helper to match model price (simplified from shared/prices.ts)
function matchModelPriceForCore(displayName: string, fastMode: boolean): number | null {
  // This is a simplified version - in practice would use the prices module
  // For now return null to avoid dependency on prices in core
  return null;
}

/**
 * Build user config from formatter options.
 */
function buildUserConfig(options: FormatterOptions): UserConfig {
  const config: UserConfig = {
    sections: {},
    items: {},
    priorityThreshold: P.NONE,
  };
  
  // Parse sections string to enable/disable
  if (options.sections) {
    const enabledSections = new Set(options.sections.split(",").map((s) => s.trim()));
    for (const sectionId of ["model", "context", "cost", "cache", "rate-limits", "usage", "vim", "worktree", "cursor-extensions"]) {
      config.sections[sectionId] = { enabled: enabledSections.has(sectionId) };
    }
  }
  
  return config;
}

/**
 * Format status line using new section-priority-based pipeline.
 * Falls back to legacy formatter if needed.
 */
export async function formatStatusLine(
  unified: UnifiedStatusInput,
  options: FormatterOptions = {}
): Promise<string> {
  const {
    width = 120,
    margin = 3,
    // sections, // Handled via buildUserConfig
    // ...other options not yet supported in new pipeline
  } = options;
  
  try {
    // 1. Adapt input for core sections
    const adaptedInput = adaptInputForCore(unified);
    
    // 2. Build user config
    const userConfig = buildUserConfig(options);
    
    // 3. Create render context
    const ctx: RenderContext = {
      input: adaptedInput,
      width: width - margin,
      target: "cli",
      config: userConfig,
    };
    
    // 4. Get sections with config applied
    // Import base sections from core
    const { DEFAULT_SECTIONS } = await import("@statusline/core");
    const sections = getSections(userConfig, ctx);
    
    // 5. Build layout
    const layout = buildLayout(sections, ctx);
    
    // 6. Render with CLI renderer
    const output = cliRenderer.render(layout, ctx);
    
    return output;
  } catch (error) {
    // Fallback to legacy formatter on error
    console.error("[statusline] New pipeline failed, falling back to legacy:", error);
    return legacyFormatStatusLine(unified, options);
  }
}

// Re-export for compatibility
export type { FormatterOptions } from "./formatter.js";