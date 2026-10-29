// Generalized formatter for multi-agent status line support

import {
  DEFAULT_BASE_MODEL,
  DEFAULT_SECTIONS,
  DEFAULT_RESETS,
  DEFAULT_CONTEXT_WARN,
  DEFAULT_CONTEXT_CRIT,
  DEFAULT_CACHE_WARN,
  DEFAULT_CACHE_CRIT,
  DEFAULT_RESET_WARN,
  DEFAULT_RESET_CRIT,
  DEFAULT_WIDTH,
  DEFAULT_MARGIN,
  DEFAULT_FRESH_TOKENS,
  DEFAULT_SUMMARY_TOKENS,
  DEFAULT_OVERHEAD_WARN,
  DEFAULT_OVERHEAD_CRIT,
  BLOCK_CHARS,
  LEFT_BORDER,
  RIGHT_BORDER,
} from "shared/constants.js";
import { RESET, DIM, CYAN, GREEN, YELLOW, RED, dim, cyan, green, yellow, red } from "shared/colors.js";
import { fmtDur, fmtTok, money } from "shared/formatting.js";
import { visibleWidth } from "shared/terminal.js";
import { loadPrices, matchModelPrice } from "shared/prices.js";
import { UnifiedStatusInput, UnifiedExtensions, RateLimitWindow, AgentType } from "adapters/index.js";

export interface FormatterSettings {
  baseModel: string;
  sections: string;
  resets: string;
  pricesTtl: number;
  contextWarn: number;
  contextCrit: number;
  cacheWarn: number;
  cacheCrit: number;
  resetWarn: number;
  resetCrit: number;
  width: number;
  margin: number;
  dumpPath: string;
  freshTokens: number;
  summaryTokens: number;
  overheadWarn: number;
  overheadCrit: number;
}

export interface SectionConfig {
  name: string;
  enabled: boolean;
  order: number;
  // Agent-specific visibility rules
  visibleWhen?: (input: UnifiedStatusInput) => boolean;
}

interface RenderParts {
  model: string;
  context: string;
  contextShort: string;
  tokens: string;
  cost: string;
  overhead: string;
  overheadShort: string;
  cache: string;
  cacheShort: string;
  limits: string[];
  custom: string | null;
}

interface ParsedRateLimitRow {
  key: string;
  alias: string;
  name: string;
  pct: string;
  resets_at: string;
  total: string;
}

function convertRateLimitWindow(window: RateLimitWindow): ParsedRateLimitRow {
  return {
    key: window.id,
    alias: window.id,
    name: window.name,
    pct: window.usedPercentage != null ? String(window.usedPercentage) : "-",
    resets_at: String(window.resetsAt),
    total: window.limit != null ? String(window.limit) : "-",
  };
}

function parseCustomReset(): { label: string; timestamp: number } | null {
  const custom = process.env.STATUSLINE_CUSTOM_RESET;
  if (!custom) return null;

  const [label, dateStr] = custom.split("|");
  if (!label || !dateStr) return null;

  let timestamp: number;
  try {
    timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) throw new Error();
  } catch {
    try {
      timestamp = new Date(dateStr.replace(" ", "T")).getTime();
      if (isNaN(timestamp)) throw new Error();
    } catch {
      return null;
    }
  }

  return { label, timestamp: Math.floor(timestamp / 1000) };
}

function isSectionEnabled(sections: string, name: string): boolean {
  return sections.split(",").includes(name);
}

function buildLimits(
  rateLimits: ParsedRateLimitRow[],
  resetsSetting: string,
  showNamed: boolean,
  showTotal: boolean,
  resetWarn: number,
  resetCrit: number
): string[] {
  const limits: string[] = [];

  let want: string[];
  if (resetsSetting === "all") {
    want = rateLimits.map((r) => r.key);
  } else if (resetsSetting === "none") {
    want = [];
  } else {
    want = resetsSetting.split(",").map((s) => s.trim());
  }

  for (const tok of want) {
    if (tok === "none") continue;
    for (const row of rateLimits) {
      if (tok !== row.key && tok !== row.alias) continue;
      if (row.name && !showNamed) continue;

      let namePart = "";
      if (row.name) namePart = `${dim(row.name)} `;

      let pctPart = "";
      if (row.pct !== "-") {
        const rpct = parseInt(row.pct, 10);
        let lcolor = GREEN;
        if (rpct >= resetCrit) lcolor = RED;
        else if (rpct >= resetWarn) lcolor = YELLOW;
        pctPart = `${lcolor}${rpct}%${RESET} `;
      }

      let totPart = "";
      if (showTotal && row.total !== "-") {
        totPart = ` ${dim(`/ ${row.total}`)}`;
      }

      const now = Math.floor(Date.now() / 1000);
      const left = parseInt(row.resets_at, 10) - now;
      limits.push(`${namePart}${pctPart}${fmtDur(left)}${totPart}`);
    }
  }

  return limits;
}

async function computeParts(
  unified: UnifiedStatusInput,
  settings: FormatterSettings,
  prices: { models: Record<string, any> }
): Promise<RenderParts> {
  const { model, context, usage, cost, cache, extensions } = unified;
  
  // Price multiplier
  let modelDisplay = model.displayName;
  const mult = matchModelPrice(prices, model.displayName, settings.baseModel, extensions.fastMode === true);
  if (mult !== null && mult !== 1.0) {
    const m1 = mult.toFixed(1);
    if (m1 !== "1.0") {
      modelDisplay = `${model.displayName} x${m1.replace(/\.0$/, "")}`;
    }
  }

  // Effort level
  let effortDisplay = "";
  const effortLevel = model.capabilities.effortLevel;
  switch (effortLevel) {
    case "low":
      effortDisplay = dim("lo");
      break;
    case "medium":
      effortDisplay = green("med");
      break;
    case "high":
      effortDisplay = yellow("hi");
      break;
    case "xhigh":
      effortDisplay = red("xhi");
      break;
    case "max":
      effortDisplay = red("max");
      break;
    default:
      if (effortLevel) effortDisplay = dim(effortLevel);
  }

  // Context bar
  let contextBar = "";
  let contextBarShort = "";
  let pctUsed = 0;
  if (context.usedPercentage !== null) {
    pctUsed = Math.round(context.usedPercentage);
    const blockIdx = Math.min(Math.floor(pctUsed / 12.5), 7);
    const fill = BLOCK_CHARS[blockIdx];

    let color = GREEN;
    if (pctUsed >= settings.contextCrit) color = RED;
    else if (pctUsed >= settings.contextWarn) color = YELLOW;

    const ctxChar = `${color}${LEFT_BORDER}${fill}${RIGHT_BORDER}${RESET}`;
    const ctxPct = `${color}${pctUsed}%${RESET}`;

    const sizeStr = context.maxTokens
      ? `${DIM}/${context.maxTokens >= 1000000 ? Math.floor(context.maxTokens / 1000000) + "M" : Math.floor(context.maxTokens / 1000) + "k"}${RESET}`
      : "";

    contextBar = `${ctxChar} ${ctxPct}${sizeStr}`;
    contextBarShort = `${ctxChar} ${ctxPct}`;
  } else {
    contextBar = `${DIM}(no context data)${RESET}`;
    contextBarShort = contextBar;
  }

  // Session tokens
  let tokensDisplay = "";
  if (usage.inputTokens !== null && usage.outputTokens !== null) {
    tokensDisplay = `${fmtTok(usage.inputTokens + usage.outputTokens)} ${dim("tok")}`;
  }

  // Session cost
  let costDisplay = "";
  if (cost.sessionCostUsd !== null) {
    costDisplay = `${money(cost.sessionCostUsd)} ${dim("sess")}`;
  }

  // Prompt cache
  let cacheDisplay = "";
  let cacheShortDisplay = "";
  let cacheCold = false;

  if (cache.ttlSeconds !== null) {
    const statsEnabled = isSectionEnabled(settings.sections, "stats");
    let stats = "";

    if (cache.hitRatio != null && (statsEnabled || cache.hitRatio < 0.8)) {
      const sp = Math.round(cache.hitRatio * 100);
      const scolor = sp < 80 ? RED : GREEN;
      stats = ` ${scolor}${sp}%${RESET}`;
    }

    if (cache.warm && cache.expiresAt != null) {
      const now = Math.floor(Date.now() / 1000);
      const rem = cache.expiresAt - now;
      if (rem > 0) {
        let ccolor = GREEN;
        if (rem < settings.cacheWarn * 60) ccolor = YELLOW;
        if (rem < settings.cacheCrit * 60) ccolor = RED;

        let remMinutes = rem >= 60 ? Math.floor(rem / 60) * 60 : rem;
        let ctime = fmtDur(remMinutes);
        ctime = ctime.replace(/ 0s$/, "").replace(/ /g, "");
        cacheDisplay = `${dim("⏱")} ${ccolor}${ctime}${RESET}`;
      }
    }

    if (!cacheDisplay) {
      cacheDisplay = red("⏱ cold");
      cacheCold = true;
    }

    cacheShortDisplay = cacheDisplay;
    cacheDisplay = `${cacheDisplay}${stats}`;
  }

  // Overhead
  let overheadDisplay = "";
  let overheadShortDisplay = "";
  const ctoks = cache.recacheTokensIfCold;
  if (isSectionEnabled(settings.sections, "overhead") && cache.ttlSeconds !== null && ctoks != null) {
    if (ctoks > settings.freshTokens) {
      const modelPrices = prices.models[model.displayName] || prices.models[`Claude ${model.displayName}`] || prices.models[model.displayName.toLowerCase()] || prices.models[`claude ${model.displayName.toLowerCase()}`];
      if (modelPrices) {
        const pin = extensions.fastMode === true && modelPrices.fast_in ? modelPrices.fast_in : modelPrices.in;
        const pout = modelPrices.out;
        const wmul = cache.ttlSeconds === 3600 ? 2 : 1.25;

        const d = ctoks - settings.freshTokens;
        const oCall = (d * 0.1 * pin) / 1e6;
        const oCold = (d * wmul * pin) / 1e6;
        const oBe = settings.freshTokens * wmul / (d * 0.1);
        const oCompact = (ctoks * 0.1 * pin + settings.summaryTokens * pout + (settings.freshTokens + settings.summaryTokens) * wmul * pin) / 1e6;

        const ocents = Math.round(oCall * 100);
        let ocolor = GREEN;
        if (ocents >= settings.overheadWarn) ocolor = YELLOW;
        if (ocents >= settings.overheadCrit) ocolor = RED;

        const be = Math.ceil(oBe);
        const beDisplay = be < 1 ? 1 : be;

        if (cacheCold) {
          overheadShortDisplay = `${RED}cold +${money(oCold)}${RESET}`;
          overheadDisplay = overheadShortDisplay;
        } else {
          overheadShortDisplay = `${ocolor}+${money(oCall)}/call${RESET}`;
          overheadDisplay = `${overheadShortDisplay} ${dim(`new@${beDisplay}`)}`;
        }

        if (context.usedPercentage !== null && context.usedPercentage >= settings.contextCrit) {
          const compactStr = ` ${dim("compact")} ${money(oCompact)}`;
          overheadDisplay += compactStr;
          overheadShortDisplay += compactStr;
        }
      }
    }
  }

  // Custom reset
  const customReset = parseCustomReset();
  const custom = customReset ? `${dim(customReset.label)} ${fmtDur(customReset.timestamp - Math.floor(Date.now() / 1000))}` : null;

  return {
    model: `${cyan(modelDisplay)}${effortDisplay ? ` ${effortDisplay}` : ""}`,
    context: contextBar,
    contextShort: contextBarShort,
    tokens: tokensDisplay,
    cost: costDisplay,
    overhead: overheadDisplay,
    overheadShort: overheadShortDisplay,
    cache: cacheDisplay,
    cacheShort: cacheShortDisplay,
    limits: [],
    custom,
  };
}

function render(
  parts: RenderParts,
  settings: FormatterSettings,
  level: number,
  rateLimits: ParsedRateLimitRow[],
  customReset: { label: string; timestamp: number } | null
): string {
  const sep = `${DIM} | ${RESET}`;
  const showNamed = level < 1;
  let showTotal = level < 3;
  const onlyFirstWindow = level >= 4;

  let modelPart = parts.model;
  let contextPart = parts.context;
  let cachePart = parts.cache;
  let overheadPart = parts.overhead;
  let costPart = parts.cost;
  let tokensPart = parts.tokens;
  let customPart = parts.custom;

  if (level >= 1) {
    contextPart = parts.contextShort;
    customPart = null;
  }
  if (level >= 2) {
    cachePart = parts.cacheShort;
    overheadPart = parts.overheadShort;
  }
  if (level >= 3) {
    showTotal = false;
    costPart = "";
  }
  if (level >= 4) {
    modelPart = cyan(parts.model.split(" x")[0]);
  }
  if (level >= 5) {
    cachePart = "";
    tokensPart = "";
    overheadPart = "";
  }
  if (level >= 6) {
    // limits will be empty
  }

  const limits = buildLimits(
    rateLimits,
    settings.resets,
    showNamed,
    showTotal,
    settings.resetWarn,
    settings.resetCrit
  );

  let finalLimits = limits;
  if (onlyFirstWindow) {
    finalLimits = limits.slice(0, 1);
  }
  if (level === 0 && customPart) {
    finalLimits = [...finalLimits, customPart];
  }

  const enabledSections = settings.sections.split(",");
  const outputParts: string[] = [];

  if (enabledSections.includes("model")) outputParts.push(modelPart);
  if (enabledSections.includes("context")) {
    if (enabledSections.includes("overhead")) {
      outputParts.push(`${contextPart}${overheadPart ? ` ${overheadPart}` : ""}`);
    } else {
      outputParts.push(contextPart);
    }
  } else if (enabledSections.includes("overhead")) {
    outputParts.push(overheadPart);
  }
  if (enabledSections.includes("tokens")) outputParts.push(tokensPart);
  if (enabledSections.includes("cost")) outputParts.push(costPart);
  if (enabledSections.includes("cache")) outputParts.push(cachePart);
  if (enabledSections.includes("resets")) outputParts.push(...finalLimits);

  return outputParts.filter((p) => p).join(sep);
}

export interface FormatterOptions {
  width?: number;
  margin?: number;
  sections?: string;
  resets?: string;
  contextWarn?: number;
  contextCrit?: number;
  cacheWarn?: number;
  cacheCrit?: number;
  resetWarn?: number;
  resetCrit?: number;
  freshTokens?: number;
  summaryTokens?: number;
  overheadWarn?: number;
  overheadCrit?: number;
  baseModel?: string;
  pricesTtl?: number;
  dumpPath?: string;
  claudeConfigDir?: string;
}

/**
 * Generate status line from unified input using generalized formatter
 */
export async function formatStatusLine(
  unified: UnifiedStatusInput,
  options: FormatterOptions = {}
): Promise<string> {
  const {
    width = DEFAULT_WIDTH,
    margin = DEFAULT_MARGIN,
    sections = DEFAULT_SECTIONS,
    resets = DEFAULT_RESETS,
    contextWarn = DEFAULT_CONTEXT_WARN,
    contextCrit = DEFAULT_CONTEXT_CRIT,
    cacheWarn = DEFAULT_CACHE_WARN,
    cacheCrit = DEFAULT_CACHE_CRIT,
    resetWarn = DEFAULT_RESET_WARN,
    resetCrit = DEFAULT_RESET_CRIT,
    freshTokens = DEFAULT_FRESH_TOKENS,
    summaryTokens = DEFAULT_SUMMARY_TOKENS,
    overheadWarn = DEFAULT_OVERHEAD_WARN,
    overheadCrit = DEFAULT_OVERHEAD_CRIT,
    baseModel = DEFAULT_BASE_MODEL,
    pricesTtl = 3600,
    dumpPath,
    claudeConfigDir,
  } = options;

  // Load prices
  const prices = await loadPrices(claudeConfigDir || "", pricesTtl);

  // Convert unified rate limits to legacy format
  const rateLimits = unified.rateLimits.map(convertRateLimitWindow);

  // Compute parts
  const settings: FormatterSettings = {
    baseModel,
    sections,
    resets,
    pricesTtl,
    contextWarn,
    contextCrit,
    cacheWarn,
    cacheCrit,
    resetWarn,
    resetCrit,
    width,
    margin,
    dumpPath: dumpPath || "",
    freshTokens,
    summaryTokens,
    overheadWarn,
    overheadCrit,
  };

  const parts = await computeParts(unified, settings, prices);
  const customReset = parseCustomReset();

  // Render with compaction
  let level = 0;
  let line = render(parts, settings, level, rateLimits, customReset);

  // Terminal width - use agent-provided width if available (Cursor)
  let cols = width;
  if (cols === 0) {
    const agentWidth = unified.extensions.renderWidthChars;
    if (typeof agentWidth === "number" && agentWidth > 0) {
      cols = agentWidth;
    }
  }

  if (cols > 0) {
    while (visibleWidth(line) > cols - margin && level < 6) {
      level++;
      line = render(parts, settings, level, rateLimits, customReset);
    }
  }

  // Dump width diagnostics
  if (dumpPath) {
    try {
      const { promises: fs } = await import("fs");
      await fs.appendFile(dumpPath, `\ncols=${cols} margin=${margin} level=${level} visible=${visibleWidth(line)}`);
    } catch {
      // Ignore
    }
  }

  return line;
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