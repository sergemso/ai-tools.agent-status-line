// Refresh model prices from the pricing page
import { join } from "path";
import { promises as fs } from "fs";
import { fetchWithTimeout } from "utils/http.js";
import { tryLock, releaseLock, atomicWrite, getMtime } from "utils/fs.js";
import { getPricesPath, savePrices } from "shared/prices.js";
import { PRICING_URL, RETRY_AFTER_FAILURE, LOCK_STALE_AFTER } from "shared/constants.js";
export async function refreshPrices(claudeConfigDir, ttl = 3600) {
    const pricesPath = getPricesPath(claudeConfigDir);
    const lockPath = join(claudeConfigDir, ".model-prices.lock.d");
    const failPath = join(claudeConfigDir, ".model-prices.fail");
    // Check for stale lock
    try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_AFTER) {
            await fs.rmdir(lockPath);
        }
    }
    catch {
        // Lock doesn't exist
    }
    // Try to acquire lock
    const lockAcquired = await tryLock(lockPath, LOCK_STALE_AFTER);
    if (!lockAcquired)
        return;
    try {
        // Check if prices are still fresh
        const age = await getMtime(pricesPath);
        if (age > 0 && Date.now() - age < ttl * 1000)
            return;
        // Check retry after failure
        const failAge = await getMtime(failPath);
        if (failAge > 0 && Date.now() - failAge < RETRY_AFTER_FAILURE * 1000)
            return;
        // Fetch pricing page
        const response = await fetchWithTimeout(PRICING_URL, { timeout: 20000 });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        // Parse the HTML
        const rows = parsePricingPage(html);
        if (rows.length < 3)
            throw new Error("Insufficient price data parsed");
        // Build price table
        const models = {};
        // First pass: main models (type M)
        for (const row of rows) {
            if (row.type === "M" && row.in != null && row.out != null) {
                if (!models[row.name]) {
                    models[row.name] = { in: row.in, out: row.out };
                }
            }
        }
        // Second pass: fast models (type F)
        for (const row of rows) {
            if (row.type === "F" && row.fast_in != null) {
                if (models[row.name]) {
                    models[row.name].fast_in = row.fast_in;
                }
            }
        }
        const table = { models };
        await savePrices(claudeConfigDir, table);
        await fs.unlink(failPath).catch(() => { });
    }
    catch (error) {
        // Touch fail file
        await atomicWrite(failPath, "");
        console.error("Price refresh failed:", error);
    }
    finally {
        await releaseLock(lockPath);
    }
}
function parsePricingPage(html) {
    const rows = [];
    let mode = 0; // 0 = none, 1 = main table, 2 = fast table
    let rowCount = 0;
    const lines = html.split("\n");
    for (const line of lines) {
        // Detect table start
        if (!mode && line.includes("Base input tokens")) {
            mode = 1;
            rowCount = 0;
            continue;
        }
        if (!mode && line.includes("provides significantly faster")) {
            mode = 2;
            rowCount = 0;
            continue;
        }
        if (mode && line.trim().startsWith("|")) {
            rowCount++;
            if (rowCount <= 2)
                continue; // Skip header and separator
            const cells = line.split("|").map((c) => c.trim()).filter((c) => c);
            if (cells.length < 3)
                continue;
            if (mode === 1) {
                // Main table: | Name | ... | Input | ... | Output |
                const name = cells[1].replace(/ \(.*$/, "");
                const inPrice = extractPrice(cells[2]);
                const outPrice = extractPrice(cells[cells.length - 2]);
                if (inPrice != null && outPrice != null) {
                    rows.push({ type: "M", name, in: inPrice, out: outPrice });
                }
            }
            else if (mode === 2) {
                // Fast table: | Name | ... | Fast Input |
                const fastPrice = extractPrice(cells[2]);
                if (fastPrice != null) {
                    // Name might be "Opus 5 / Sonnet 5.5" - split by " / "
                    const names = cells[1].split(" / ").map((n) => n.trim());
                    for (const n of names) {
                        rows.push({ type: "F", name: n, fast_in: fastPrice });
                    }
                }
            }
            continue;
        }
        // Table ended
        if (mode && rowCount > 0 && !line.trim().startsWith("|")) {
            mode = 0;
        }
    }
    return rows;
}
function extractPrice(text) {
    const match = text.match(/\$([0-9.]+)/);
    return match ? parseFloat(match[1]) : null;
}
//# sourceMappingURL=refresh-prices.js.map