// Main status line generator - refactored to use adapter pattern

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { ConfigSettings, ParsedRateLimitRow } from "shared/types.js";
import {
  DEFAULT_BASE_MODEL,
  DEFAULT_SECTIONS,
  DEFAULT_RESETS,
  DEFAULT_PRICES_TTL,
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
import { fmtDur, fmtTok, money, parseIntSetting } from "shared/formatting.js";
import { detectCols, visibleWidth } from "shared/terminal.js";
import { loadConfig, getSetting } from "shared/config-file.js";
import { loadPrices, matchModelPrice } from "shared/prices.js";
import { getClaudeConfigDir } from "utils/config-utils.js";
import { adapterRegistry, UnifiedStatusInput, RateLimitWindow, UnifiedExtensions } from "adapters/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

interface Settings {
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

interface ParsedInput {
  model: string;
  modelPlain: string;
  fastMode: boolean;
  effortLevel: string;
  usedPct: number | null;
  contextSize: number | null;
  tokIn: number | null;
  tokOut: number | null;
  costUsd: number | null;
  cacheTtl: number | null;
  cacheWarm: boolean;
  cacheExpiresAt: number | null;
  cacheHitRatio: number | null;
  cacheRecacheTokens: number | null;
  rateLimits: ParsedRateLimitRow[];
  customReset: { label: string; timestamp: number } | null;
}

interface RenderParts {
  model: string;
  context: string;
  tokens: string;
  cost: string;
  overhead: string;
  overheadShort: string;
  cache: string;
  cacheShort: string;
  limits: string[];
  custom: string | null;
}

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function getClaudeConfigDirFromEnv(): string {
  return getEnv("CLAUDE_CONFIG_DIR") || join(process.env.HOME || "~", ".claude");
}

async function loadSettings(claudeConfigDir: string): Promise<Settings> {
  const config = await loadConfig(claudeConfigDir);

  const get = (key: keyof ConfigSettings, defaultValue: string | number): string => {
    const envKey = `STATUSLINE_${key}`;
    const envVal = getEnv(envKey);
    if (envVal !== undefined) return envVal;
    const configVal = getSetting(config, key);
    if (configVal !== undefined) return configVal;
    return String(defaultValue);
  };

  const num = (key: keyof ConfigSettings, defaultValue: number): number => {
    const v = get(key, defaultValue);
    const parsed = parseInt(v, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  return {
    baseModel: get("BASE_MODEL", DEFAULT_BASE_MODEL),
    sections: get("SECTIONS", DEFAULT_SECTIONS),
    resets: get("RESETS", DEFAULT_RESETS),
    pricesTtl: num("PRICES_TTL", DEFAULT_PRICES_TTL),
    contextWarn: num("CONTEXT_WARN", DEFAULT_CONTEXT_WARN),
    contextCrit: num("CONTEXT_CRIT", DEFAULT_CONTEXT_CRIT),
    cacheWarn: num("CACHE_WARN", DEFAULT_CACHE_WARN),
    cacheCrit: num("CACHE_CRIT", DEFAULT_CACHE_CRIT),
    resetWarn: num("RESET_WARN", DEFAULT_RESET_WARN),
    resetCrit: num("RESET_CRIT", DEFAULT_RESET_CRIT),
    width: num("WIDTH", DEFAULT_WIDTH),
    margin: num("MARGIN", DEFAULT_MARGIN),
    dumpPath: get("DUMP", ""),
    freshTokens: num("FRESH_TOKENS", DEFAULT_FRESH_TOKENS),
    summaryTokens: num("SUMMARY_TOKENS", DEFAULT_SUMMARY_TOKENS),
    overheadWarn: num("OVERHEAD_WARN", DEFAULT_OVERHEAD_WARN),
    overheadCrit: num("OVERHEAD_CRIT", DEFAULT_OVERHEAD_CRIT),
  };
}

function isSectionEnabled(sections: string, name: string): boolean {
  return sections.split(",").includes(name);
}

/**
 * Convert unified rate limit window to legacy ParsedRateLimitRow format
 */
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

/**
 * Convert UnifiedStatusInput to legacy ParsedInput format for backward compatibility
 */
function unifiedToParsedInput(unified: UnifiedStatusInput): ParsedInput {
  // Extract effort level from model capabilities
  const effortLevel = unified.model.capabilities.effortLevel ?? "";
  const fastMode = unified.extensions.fastMode === true;
  
  // Convert rate limits
  const rateLimits = unified.rateLimits.map(convertRateLimitWindow);
  
  // Parse custom reset from env (same as before)
  const customReset = parseCustomReset();

  return {
    model: unified.model.displayName,
    modelPlain: unified.model.displayName,
    fastMode,
    effortLevel,
    usedPct: unified.context.usedPercentage,
    contextSize: unified.context.maxTokens || null,
    tokIn: unified.usage.inputTokens || null,
    tokOut: unified.usage.outputTokens || null,
    costUsd: unified.cost.sessionCostUsd,
    cacheTtl: unified.cache.ttlSeconds,
    cacheWarm: unified.cache.warm,
    cacheExpiresAt: unified.cache.expiresAt ?? null,
    cacheHitRatio: unified.cache.hitRatio ?? null,
    cacheRecacheTokens: unified.cache.recacheTokensIfCold ?? null,
    rateLimits,
    customReset,
  };
}

function parseCustomReset(): { label: string; timestamp: number } | null {
  const custom = getEnv("STATUSLINE_CUSTOM_RESET");
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

async function computeParts(
  parsed: ParsedInput,
  settings: Settings,
  prices: { models: Record<string, any> }
): Promise<RenderParts> {
  const { model, modelPlain, fastMode, effortLevel, usedPct, contextSize, tokIn, tokOut, costUsd, cacheTtl, cacheWarm, cacheExpiresAt, cacheHitRatio, cacheRecacheTokens } = parsed;

  // Price multiplier
  let modelDisplay = model;
  const mult = matchModelPrice(prices, model, settings.baseModel, fastMode);
  if (mult !== null && mult !== 1.0) {
    const m1 = mult.toFixed(1);
    if (m1 !== "1.0") {
      modelDisplay = `${modelPlain} x${m1.replace(/\.0$/, "")}`;
    }
  }

  // Effort level
  let effortDisplay = "";
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
  if (usedPct !== null) {
    pctUsed = Math.round(usedPct);
    const blockIdx = Math.min(Math.floor(pctUsed / 12.5), 7);
    const fill = BLOCK_CHARS[blockIdx];

    let color = GREEN;
    if (pctUsed >= settings.contextCrit) color = RED;
    else if (pctUsed >= settings.contextWarn) color = YELLOW;

    const ctxChar = `${color}${LEFT_BORDER}${fill}${RIGHT_BORDER}${RESET}`;
    const ctxPct = `${color}${pctUsed}%${RESET}`;

    const sizeStr = contextSize
      ? `${DIM}/${contextSize >= 1000000 ? Math.floor(contextSize / 1000000) + "M" : Math.floor(contextSize / 1000) + "k"}${RESET}`
      : "";

    contextBar = `${ctxChar} ${ctxPct}${sizeStr}`;
    contextBarShort = `${ctxChar} ${ctxPct}`;
  } else {
    contextBar = `${DIM}(no context data)${RESET}`;
    contextBarShort = contextBar;
  }

  // Session tokens
  let tokensDisplay = "";
  if (tokIn !== null && tokOut !== null) {
    tokensDisplay = `${fmtTok(tokIn + tokOut)} ${dim("tok")}`;
  }

  // Session cost
  let costDisplay = "";
  if (costUsd !== null) {
    costDisplay = `${money(costUsd)} ${dim("sess")}`;
  }

  // Prompt cache
  let cacheDisplay = "";
  let cacheShortDisplay = "";
  let cacheCold = false;

  if (cacheTtl !== null) {
    const statsEnabled = isSectionEnabled(settings.sections, "stats");
    let stats = "";

    if (cacheHitRatio !== null && (statsEnabled || cacheHitRatio < 0.8)) {
      const sp = Math.round(cacheHitRatio * 100);
      const scolor = sp < 80 ? RED : GREEN;
      stats = ` ${scolor}${sp}%${RESET}`;
    }

    if (cacheWarm && cacheExpiresAt !== null) {
      const now = Math.floor(Date.now() / 1000);
      const rem = cacheExpiresAt - now;
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
  if (isSectionEnabled(settings.sections, "overhead") && cacheTtl !== null && cacheRecacheTokens !== null) {
    const ctoks = cacheRecacheTokens;
    if (ctoks > settings.freshTokens) {
      const modelPrices = prices.models[model] || prices.models[`Claude ${model}`] || prices.models[model.toLowerCase()] || prices.models[`claude ${model.toLowerCase()}`];
      if (modelPrices) {
        const pin = fastMode && modelPrices.fast_in ? modelPrices.fast_in : modelPrices.in;
        const pout = modelPrices.out;
        const wmul = cacheTtl === 3600 ? 2 : 1.25;

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

        if (usedPct !== null && usedPct >= settings.contextCrit) {
          const compactStr = ` ${dim("compact")} ${money(oCompact)}`;
          overheadDisplay += compactStr;
          overheadShortDisplay += compactStr;
        }
      }
    }
  }

  return {
    model: `${cyan(modelDisplay)}${effortDisplay ? ` ${effortDisplay}` : ""}`,
    context: contextBar,
    tokens: tokensDisplay,
    cost: costDisplay,
    overhead: overheadDisplay,
    overheadShort: overheadShortDisplay,
    cache: cacheDisplay,
    cacheShort: cacheShortDisplay,
    limits: [],
    custom: parsed.customReset ? `${dim(parsed.customReset.label)} ${fmtDur(parsed.customReset.timestamp - Math.floor(Date.now() / 1000))}` : null,
  };
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

function render(
  parts: RenderParts,
  settings: Settings,
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
    contextPart = parts.context.split(" ")[0] + " " + parts.context.split(" ")[1];
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

  let limits = buildLimits(
    rateLimits,
    settings.resets,
    showNamed,
    showTotal,
    settings.resetWarn,
    settings.resetCrit
  );

  if (onlyFirstWindow) {
    limits = limits.slice(0, 1);
  }
  if (level === 0 && customPart) {
    limits.push(customPart);
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
  if (enabledSections.includes("resets")) outputParts.push(...limits);

  return outputParts.filter((p) => p).join(sep);
}

/**
 * Generate status line from JSON input using adapter pattern
 */
export async function generateStatusLine(input: string): Promise<string> {
  const claudeConfigDir = getClaudeConfigDirFromEnv();
  const settings = await loadSettings(claudeConfigDir);

  // Parse input using adapter registry (auto-detects agent)
  let unifiedInput: UnifiedStatusInput;
  try {
    const rawInput = JSON.parse(input);
    unifiedInput = adapterRegistry.parse(rawInput);
  } catch (error) {
    throw new Error(`Failed to parse input: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Dump raw input if requested
  if (settings.dumpPath) {
    try {
      const { promises: fs } = await import("fs");
      await fs.writeFile(settings.dumpPath, input);
    } catch {
      // Ignore
    }
  }

  // Load prices (may trigger background refresh)
  const prices = await loadPrices(claudeConfigDir, settings.pricesTtl);

  // Trigger background price refresh if needed
  const pricesPath = join(claudeConfigDir, "model-prices.json");
  try {
    const stat = await import("fs").then((fs) => fs.promises.stat(pricesPath));
    const age = Date.now() - stat.mtimeMs;
    if (age >= settings.pricesTtl * 1000) {
      import("./refresh-prices.js").then(({ refreshPrices }) => {
        refreshPrices(claudeConfigDir, settings.pricesTtl).catch(() => {});
      });
    }
  } catch {
    import("./refresh-prices.js").then(({ refreshPrices }) => {
      refreshPrices(claudeConfigDir, settings.pricesTtl).catch(() => {});
    });
  }

  // Convert unified input to legacy format for computeParts
  const parsed = unifiedToParsedInput(unifiedInput);

  // Compute parts
  const parts = await computeParts(parsed, settings, prices);

  // Terminal width - use agent-provided width if available (Cursor)
  let cols = settings.width;
  if (cols === 0) {
    const agentWidth = unifiedInput.extensions.renderWidthChars;
    if (typeof agentWidth === "number" && agentWidth > 0) {
      cols = agentWidth;
    } else {
      cols = await detectCols();
    }
  }

  // Render with compaction
  let level = 0;
  let line = render(parts, settings, level, parsed.rateLimits, parsed.customReset);

  if (cols > 0) {
    while (visibleWidth(line) > cols - settings.margin && level < 6) {
      level++;
      line = render(parts, settings, level, parsed.rateLimits, parsed.customReset);
    }
  }

  // Apply agent-specific output formatting if needed
  const adapter = adapterRegistry.get(unifiedInput.agent);
  if (adapter?.formatOutput) {
    line = adapter.formatOutput(line, unifiedInput.extensions);
  }

  // Dump width diagnostics
  if (settings.dumpPath) {
    try {
      const { promises: fs } = await import("fs");
      await fs.appendFile(settings.dumpPath, `\ncols=${cols} margin=${settings.margin} level=${level} visible=${visibleWidth(line)}`);
    } catch {
      // Ignore
    }
  }

  return line;
}