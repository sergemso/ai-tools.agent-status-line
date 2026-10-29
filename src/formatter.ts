/**
 * New formatter using section-priority-based rendering from @statusline/core.
 * This replaces the legacy formatter.ts with the new pipeline.
 */

import { formatStatusLine as legacyFormatStatusLine } from "./formatter.legacy.js";
import type { FormatterOptions } from "./formatter.legacy.js";
import type { UnifiedStatusInput } from "./adapters/index.js";
import { loadPrices, matchModelPrice } from "./shared/prices.js";
import { loadFactor } from "shared/multipliers.js";
import {
  DEFAULT_BASE_MODEL,
  DEFAULT_FRESH_TOKENS,
  DEFAULT_SUMMARY_TOKENS,
} from "./shared/constants.js";

import {
  buildLayout,
  getSections,
  type RenderContext,
  type UserConfig,
  PriorityLevel as P,
} from "@statusline/core";
import { cliRenderer, parseFormats, FORMAT_LEVELS, unicodeOk, setEmojiWidth } from "@statusline/core";

/**
 * Convert unified input to the format expected by core sections.
 * This adapts the existing UnifiedStatusInput to the section item generators.
 */
async function adaptInputForCore(
  unified: UnifiedStatusInput,
  prices: any,
  options: FormatterOptions
): Promise<any> {
  const { model, context, usage, cost, cache, rateLimits, extensions } = unified;

  // Calculate overhead (ported from legacy formatter). Pass the
  // user-configured freshTokens / summaryTokens / baseModel so the
  // new pipeline matches the legacy behavior instead of using hardcoded
  // defaults that ignore the user's STATUSLINE_FRESH_TOKENS /
  // STATUSLINE_SUMMARY_TOKENS / STATUSLINE_BASE_MODEL settings.
  const overhead = calculateOverhead(unified, prices, options);

  // Calculate cost multiplier — use the user-configured baseModel,
  // not a hardcoded "Claude Sonnet 5.5".
  const baseModel = options.baseModel ?? DEFAULT_BASE_MODEL;
  const costMultiplier = matchModelPrice(prices, model.displayName, baseModel, extensions.fastMode === true);
  const factor = await loadFactor(options.claudeConfigDir || "", model.displayName, model.capabilities.effortLevel);
  const combined = costMultiplier !== null ? Math.round(costMultiplier * factor * 10) / 10 : factor !== 1 ? factor : null;

  return {
    model: {
      name: model.displayName,
      effort: model.capabilities.effortLevel,
      costMultiplier: combined !== null && combined !== 1 ? combined : null,
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
      expiresAt: cache.expiresAt,
    } : null,
    rateLimits: rateLimits.map((r) => ({
      window: r.id,
      limit: r.limit,
      remaining: r.limit !== null ? r.limit - (r.limit * (r.usedPercentage ?? 0) / 100) : 0,
      resetsAt: r.resetsAt,
    })),
    overhead,
    usage: {
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      cacheTokens: cache.recacheTokensIfCold,
    },
    vim: extensions.vimMode ? { mode: extensions.vimMode } : null,
    worktree: extensions.worktree ? { name: extensions.worktree.name } : null,
    cursorExtensions: extensions.maxMode || extensions.paramSummary || extensions.autorun ? {
      maxMode: extensions.maxMode,
      paramSummary: extensions.paramSummary,
      autorun: extensions.autorun,
    } : null,
  };
}

/** Calculate overhead - ported from legacy formatter.
 *  Honors user-configured freshTokens / summaryTokens via FormatterOptions
 *  (previously hardcoded to 25000 / 8000). */
function calculateOverhead(
  unified: UnifiedStatusInput,
  prices: any,
  options: FormatterOptions
): any {
  const { cache, model, extensions } = unified;
  const ctoks = cache.recacheTokensIfCold;
  const freshTokens = options.freshTokens ?? DEFAULT_FRESH_TOKENS;
  const summaryTokens = options.summaryTokens ?? DEFAULT_SUMMARY_TOKENS;

  if (ctoks == null || cache.ttlSeconds == null || ctoks <= freshTokens) {
    return { show: false };
  }

  const modelPrices = prices.models[model.displayName] ||
    prices.models[`Claude ${model.displayName}`] ||
    prices.models[model.displayName.toLowerCase()] ||
    prices.models[`claude ${model.displayName.toLowerCase()}`];

  if (!modelPrices) {
    return { show: false };
  }

  const pin = extensions.fastMode === true && modelPrices.fast_in ? modelPrices.fast_in : modelPrices.in;
  const pout = modelPrices.out;
  const wmul = cache.ttlSeconds === 3600 ? 2 : 1.25;

  const d = ctoks - freshTokens;
  // Next request: re-read the whole context from cache (10%), or re-write it if cold
  const oCall = (ctoks * (cache.warm ? 0.1 : wmul) * pin) / 1e6;
  const oCold = (d * wmul * pin) / 1e6;
  const oCompact = (ctoks * 0.1 * pin + summaryTokens * pout + (freshTokens + summaryTokens) * wmul * pin) / 1e6;
  // Break-even in expected calls n: restart = oCompact + n*newCall, stay = oCall + (n-1)*readCost.
  // Solve restart <= X*stay for the smallest n: redFrom (X=1, restart cheaper) and, with a 30%
  // margin (X=1.3), the end of the green zone. Infinity = restarting never wins (new call >= stay call).
  const readCost = (ctoks * 0.1 * pin) / 1e6;
  const newCall = ((freshTokens + summaryTokens) * 0.1 * pin) / 1e6;
  const firstN = (x: number): number => {
    const den = x * readCost - newCall;
    if (den <= 0) return Infinity;
    return Math.max(1, Math.ceil((oCompact - x * (oCall - readCost)) / den));
  };
  const redFrom = firstN(1);
  const yellowFrom = Math.min(firstN(1.3), redFrom);

  return {
    show: true,
    costPerCall: oCall,
    breakEven: { yellowFrom, redFrom },
    compactCost: oCompact,
    isCold: !cache.warm,
    coldCost: oCold,
  };
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

  // Parse sections string to enable/disable.
  // Legacy default sections: model,context,cost,overhead,cache,resets
  if (options.sections) {
    const enabledSections = new Set(options.sections.split(",").map((s) => s.trim()));
    // Map legacy section names to new section IDs. Several legacy names
    // (e.g. "cache" and "stats") may map to the same new section id.
    const sectionMap: Record<string, string> = {
      "model": "model",
      "context": "context",
      "tokens": "usage",
      "cost": "cost",
      "overhead": "overhead",
      "cache": "cache",
      "stats": "cache", // stats is part of cache (hit ratio)
      "resets": "rate-limits",
      "vim": "vim",
      "worktree": "worktree",
      "cursor-extensions": "cursor-extensions",
    };

    config.sections = config.sections || {};
    for (const [legacyName, newId] of Object.entries(sectionMap)) {
      const isEnabled = enabledSections.has(legacyName);
      const existing = config.sections[newId];
      // OR semantics: if any alias of a section id is enabled in the
      // user's sections list, the section is enabled. If none of its
      // aliases is enabled, the section is disabled. (Previously,
      // iterating in sectionMap order meant a later alias like "stats"
      // could silently overwrite an earlier "cache: false" with
      // "cache: true", defeating the user's intent.)
      if (existing === undefined) {
        config.sections[newId] = { enabled: isEnabled };
      } else if (isEnabled) {
        config.sections[newId] = { ...existing, enabled: true };
      }
      // If !isEnabled and existing already set: leave existing as-is
      // (it might have been enabled by an earlier alias).
    }
  }

  // Apply resets filter for rate-limits section
  if (options.resets) {
    const enabledResets = new Set(options.resets.split(",").map((s) => s.trim()));
    config.sections = config.sections || {};
    config.sections["rate-limits"] = config.sections["rate-limits"] || { enabled: true };
    config.sections["rate-limits"].resets = Array.from(enabledResets);
  }

  // Apply thresholds from options to config for use in sections
  if (options.contextWarn !== undefined) config.contextWarn = options.contextWarn;
  if (options.contextCrit !== undefined) config.contextCrit = options.contextCrit;
  if (options.cacheWarn !== undefined) config.cacheWarn = options.cacheWarn;
  if (options.cacheCrit !== undefined) config.cacheCrit = options.cacheCrit;
  if (options.resetWarn !== undefined) config.resetWarn = options.resetWarn;
  if (options.resetCrit !== undefined) config.resetCrit = options.resetCrit;
  if (options.overheadWarn !== undefined) config.overheadWarn = options.overheadWarn;
  if (options.overheadCrit !== undefined) config.overheadCrit = options.overheadCrit;
  if (options.format === "auto" || options.format === "glyph" || options.format === "short" || options.format === "words" || options.format === "ascii") config.format = options.format;
  if (options.formats) config.formats = parseFormats(options.formats);

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
    pricesTtl = 3600,
    claudeConfigDir,
    dumpPath,
  } = options;

  // Handle width = 0 (auto-detect) by using default but marking as unconstrained
  const isWidthConstrained = width > 0;
  const effectiveWidth = width > 0 ? width : 120;
  const effectiveMargin = margin > 0 ? margin : 3;

  try {
    // Load prices for overhead calculation
    const prices = await loadPrices(claudeConfigDir || "", pricesTtl);

    // 1. Adapt input for core sections (pass options so baseModel /
    //    freshTokens / summaryTokens are honored)
    const adaptedInput = await adaptInputForCore(unified, prices, options);

    // 2. Build user config
    const userConfig = buildUserConfig(options);

    // 3-5. Create render context, sections and layout. In auto mode try the most readable text
    // style first (words, then short, then glyph) and keep the first one in which everything fits;
    // glyph is the last resort (items drop only after that). Without a detected width, use glyph.
    const auto = !userConfig.format || userConfig.format === "auto";
    setEmojiWidth(options.emojiWidth ?? 2);
    const fallback = unicodeOk() ? "glyph" : "ascii";
    const levels = auto && isWidthConstrained && unicodeOk() ? FORMAT_LEVELS : ([fallback] as typeof FORMAT_LEVELS);
    let ctx!: RenderContext;
    let sections!: ReturnType<typeof getSections>;
    let layout!: ReturnType<typeof buildLayout>;
    for (let i = 0; i < levels.length; i++) {
      ctx = {
        input: adaptedInput,
        width: effectiveWidth - effectiveMargin,
        target: "cli",
        config: userConfig,
        formatLevel: levels[i],
        // Pass whether width is constrained (for layout engine)
        widthConstrained: isWidthConstrained,
      };
      sections = getSections(userConfig, ctx);
      layout = buildLayout(sections, ctx);
      if (!layout.meta.overflow) break;
    }

    // 6. Render with CLI renderer
    const output = cliRenderer.render(layout, ctx);

    // Dump width diagnostics (matches legacy formatter behavior).
    // Previously the new pipeline silently dropped this debug hook.
    if (dumpPath) {
      try {
        const { promises: fs } = await import("fs");
        await fs.appendFile(
          dumpPath,
          `\ncols=${effectiveWidth} margin=${effectiveMargin} format=${userConfig.format ?? "auto"}/${ctx.formatLevel} overflow=${layout.meta.overflow} dropped=${layout.meta.droppedItems.length} visible=${output.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").length}\npriorities: ${sections.map((s) => `${s.id}=${s.priority}[${s.items.map((i) => `${i.id}=${i.priority}${layout.meta.droppedItems.some((d) => d.sectionId === s.id && d.itemId === i.id) ? "(dropped)" : ""}`).join(" ")}]`).join(" ")}`
        );
      } catch {
        // Ignore — diagnostics are best-effort.
      }
    }

    return output;
  } catch (error) {
    // Fallback to legacy formatter on error
    console.error("[statusline] New pipeline failed, falling back to legacy:", error);
    return legacyFormatStatusLine(unified, options);
  }
}

// Re-export for compatibility
export type { FormatterOptions } from "./formatter.legacy.js";

import type { AgentType } from "./adapters/index.js";

/**
 * Section configuration for agent-specific defaults
 */
export interface SectionConfig {
  name: string;
  enabled: boolean;
  order: number;
  visibleWhen?: (input: UnifiedStatusInput) => boolean;
}

/**
 * Default section configurations per agent type
 */
export const DEFAULT_SECTION_CONFIGS: Record<AgentType, SectionConfig[]> = {
  "claude-code": [
    { name: "model", enabled: true, order: 1 },
    { name: "context", enabled: true, order: 2 },
    { name: "overhead", enabled: true, order: 3, visibleWhen: (input) => input.cache.ttlSeconds !== null && input.cache.recacheTokensIfCold !== null },
    { name: "tokens", enabled: false, order: 4 },
    { name: "cost", enabled: true, order: 5, visibleWhen: (input) => input.cost.sessionCostUsd !== null },
    { name: "cache", enabled: true, order: 6, visibleWhen: (input) => input.cache.ttlSeconds !== null },
    { name: "stats", enabled: false, order: 7, visibleWhen: (input) => input.cache.hitRatio !== null },
    { name: "resets", enabled: true, order: 8 },
  ],
  "cursor": [
    { name: "model", enabled: true, order: 1 },
    { name: "context", enabled: true, order: 2 },
    { name: "tokens", enabled: true, order: 3, visibleWhen: (input) => input.usage.inputTokens > 0 || input.usage.outputTokens > 0 },
    { name: "cost", enabled: false, order: 4, visibleWhen: (input) => input.cost.sessionCostUsd !== null },
    { name: "cache", enabled: false, order: 5 },
    { name: "stats", enabled: false, order: 6 },
    { name: "resets", enabled: false, order: 7 },
  ],
};

/**
 * Build sections string from section configs for an agent
 */
export function buildSectionsString(agentType: AgentType, customSections?: string): string {
  if (customSections) return customSections;
  
  const configs = DEFAULT_SECTION_CONFIGS[agentType] || DEFAULT_SECTION_CONFIGS["claude-code"];
  return configs
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order)
    .map((c) => c.name)
    .join(",");
}