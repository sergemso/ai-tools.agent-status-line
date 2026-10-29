// Main status line generator - refactored to use adapter pattern and generalized formatter
import { join } from "path";
import { fileURLToPath } from "url";
import { DEFAULT_BASE_MODEL, DEFAULT_SECTIONS, DEFAULT_RESETS, DEFAULT_PRICES_TTL, DEFAULT_CONTEXT_WARN, DEFAULT_CONTEXT_CRIT, DEFAULT_CACHE_WARN, DEFAULT_CACHE_CRIT, DEFAULT_RESET_WARN, DEFAULT_RESET_CRIT, DEFAULT_WIDTH, DEFAULT_MARGIN, DEFAULT_FRESH_TOKENS, DEFAULT_SUMMARY_TOKENS, DEFAULT_OVERHEAD_WARN, DEFAULT_OVERHEAD_CRIT, } from "shared/constants.js";
import { loadConfig, getSetting } from "shared/config-file.js";
import { adapterRegistry } from "adapters/index.js";
import { formatStatusLine, buildSectionsString } from "./formatter.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
function getEnv(key) {
    return process.env[key];
}
function getClaudeConfigDirFromEnv() {
    return getEnv("CLAUDE_CONFIG_DIR") || join(process.env.HOME || "~", ".claude");
}
async function loadSettings(claudeConfigDir) {
    const config = await loadConfig(claudeConfigDir);
    const get = (key, defaultValue) => {
        const envKey = `STATUSLINE_${key}`;
        const envVal = getEnv(envKey);
        if (envVal !== undefined)
            return envVal;
        const configVal = getSetting(config, key);
        if (configVal !== undefined)
            return configVal;
        return String(defaultValue);
    };
    const num = (key, defaultValue) => {
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
/**
 * Generate status line from JSON input using adapter pattern and generalized formatter
 */
export async function generateStatusLine(input) {
    const claudeConfigDir = getClaudeConfigDirFromEnv();
    const settings = await loadSettings(claudeConfigDir);
    // Parse input using adapter registry (auto-detects agent)
    let unifiedInput;
    try {
        const rawInput = JSON.parse(input);
        unifiedInput = adapterRegistry.parse(rawInput);
    }
    catch (error) {
        throw new Error(`Failed to parse input: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Dump raw input if requested
    if (settings.dumpPath) {
        try {
            const { promises: fs } = await import("fs");
            await fs.writeFile(settings.dumpPath, input);
        }
        catch {
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
                refreshPrices(claudeConfigDir, settings.pricesTtl).catch(() => { });
            });
        }
    }
    catch {
        import("./refresh-prices.js").then(({ refreshPrices }) => {
            refreshPrices(claudeConfigDir, settings.pricesTtl).catch(() => { });
        });
    }
    // Build agent-specific sections if not explicitly configured
    let sections = settings.sections;
    if (sections === DEFAULT_SECTIONS) {
        sections = buildSectionsString(unifiedInput.agent);
    }
    // Use generalized formatter
    const line = await formatStatusLine(unifiedInput, {
        width: settings.width,
        margin: settings.margin,
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
//# sourceMappingURL=statusline.js.map