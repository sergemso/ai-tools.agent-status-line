// Main status line generator - refactored to use adapter pattern and generalized formatter

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { ConfigSettings } from "shared/types.js";
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
} from "shared/constants.js";
import { detectCols } from "shared/terminal.js";
import { loadConfig, getSetting } from "shared/config-file.js";
import { loadPrices } from "shared/prices.js";
import { getClaudeConfigDir } from "utils/config-utils.js";
import { adapterRegistry, UnifiedStatusInput, AgentType } from "adapters/index.js";
import { formatStatusLine, buildSectionsString } from "./formatter.js";

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
  format: string;
  emojiWidth: number;
  formats: string;
  dumpPath: string;
  freshTokens: number;
  summaryTokens: number;
  overheadWarn: number;
  overheadCrit: number;
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
    format: get("FORMAT", ""),
    emojiWidth: num("EMOJI_WIDTH", 2),
    formats: get("FORMATS", ""),
    dumpPath: get("DUMP", ""),
    freshTokens: num("FRESH_TOKENS", DEFAULT_FRESH_TOKENS),
    summaryTokens: num("SUMMARY_TOKENS", DEFAULT_SUMMARY_TOKENS),
    overheadWarn: num("OVERHEAD_WARN", DEFAULT_OVERHEAD_WARN),
    overheadCrit: num("OVERHEAD_CRIT", DEFAULT_OVERHEAD_CRIT),
  };
}

/**
 * Generate status line from JSON input using adapter pattern and generalized formatter
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

  // Build agent-specific sections if not explicitly configured
  let sections = settings.sections;
  if (sections === DEFAULT_SECTIONS) {
    sections = buildSectionsString(unifiedInput.agent);
  }

  // Use generalized formatter
  const line = await formatStatusLine(unifiedInput, {
    width: settings.width > 0 ? settings.width : await detectCols(),
    margin: settings.margin,
    format: settings.format,
    emojiWidth: settings.emojiWidth,
    formats: settings.formats,
    sections,
    resets: settings.resets,
    contextWarn: settings.contextWarn,
    contextCrit: settings.contextCrit,
    cacheWarn: settings.cacheWarn,
    cacheCrit: settings.cacheCrit,
    resetWarn: settings.resetWarn,
    resetCrit: settings.resetCrit,
    freshTokens: settings.freshTokens,
    summaryTokens: settings.summaryTokens,
    overheadWarn: settings.overheadWarn,
    overheadCrit: settings.overheadCrit,
    baseModel: settings.baseModel,
    pricesTtl: settings.pricesTtl,
    dumpPath: settings.dumpPath,
    claudeConfigDir,
  });

  // Apply agent-specific output formatting if needed
  const adapter = adapterRegistry.get(unifiedInput.agent);
  if (adapter?.formatOutput) {
    return adapter.formatOutput(line, unifiedInput.extensions);
  }

  return line;
}