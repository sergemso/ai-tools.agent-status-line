// Price table loading, caching, and model matching

import { PriceTable, PriceEntry } from "./types.js";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { DEFAULT_PRICES_TTL } from "./constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pricesCache: { table: PriceTable; mtime: number } | null = null;

export function getPricesPath(claudeConfigDir: string): string {
  return join(claudeConfigDir, "model-prices.json");
}

export async function loadPrices(claudeConfigDir: string, ttl: number = DEFAULT_PRICES_TTL): Promise<PriceTable> {
  const path = getPricesPath(claudeConfigDir);
  const now = Date.now();

  // Check cache
  if (pricesCache && now - pricesCache.mtime < ttl * 1000) {
    return pricesCache.table;
  }

  // Check file mtime
  try {
    const stat = await fs.stat(path);
    if (now - stat.mtimeMs < ttl * 1000) {
      const content = await fs.readFile(path, "utf-8");
      const table = JSON.parse(content) as PriceTable;
      pricesCache = { table, mtime: stat.mtimeMs };
      return table;
    }
  } catch {
    // File doesn't exist or error
  }

  // Return empty table if not found
  return { models: {} };
}

export async function savePrices(claudeConfigDir: string, table: PriceTable): Promise<void> {
  const path = getPricesPath(claudeConfigDir);
  await ensureDir(dirname(path));

  const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  await fs.writeFile(tmp, JSON.stringify({ models: table.models }), { mode: 0o644 });
  await fs.rename(tmp, path);

  const stat = await fs.stat(path);
  pricesCache = { table, mtime: stat.mtimeMs };
}

export function matchModelPrice(
  table: PriceTable,
  modelName: string,
  baseModel: string,
  fastMode: boolean
): number | null {
  const models = table.models;
  const base = models[baseModel]?.in;
  if (!base || base === 0) return null;

  // Try exact match, with "Claude " prefix, case-insensitive
  const candidates = [
    modelName,
    `Claude ${modelName}`,
    modelName.toLowerCase(),
    `claude ${modelName.toLowerCase()}`,
  ];

  let matched: PriceEntry | undefined;
  for (const c of candidates) {
    if (models[c]) {
      matched = models[c];
      break;
    }
  }

  if (!matched) return null;

  const inputPrice = fastMode && matched.fast_in ? matched.fast_in : matched.in;
  const multiplier = (inputPrice / base) * 10;
  return Math.round(multiplier) / 10; // Round to 1 decimal place
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Ignore
  }
}