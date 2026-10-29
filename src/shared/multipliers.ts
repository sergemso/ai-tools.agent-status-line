// Optional per-model cost factors (effort level, peak hours) from <claudeConfigDir>/model-multipliers.json
// Format: { "Claude Opus 5.5": { "effort": { "high": 1.5 }, "peak": { "rate": 2, "offRate": 1, "from": 13, "to": 19, "tz": "UTC", "weekdays": true } }, "*": { ... } }

import { promises as fs } from "fs";
import { join } from "path";

interface Peak { rate?: number; offRate?: number; from?: number; to?: number; tz?: string; weekdays?: boolean }
interface Entry { effort?: Record<string, number>; peak?: Peak }

export async function loadFactor(claudeConfigDir: string, modelName: string, effort: string | undefined, now: Date = new Date()): Promise<number> {
  let table: Record<string, Entry>;
  try {
    table = JSON.parse(await fs.readFile(join(claudeConfigDir, "model-multipliers.json"), "utf8"));
  } catch {
    return 1;
  }
  const key = [modelName, `Claude ${modelName}`, "*"].find((k) => table[k]);
  const entry = key ? table[key] : undefined;
  if (!entry) return 1;

  let factor = effort ? entry.effort?.[effort] ?? 1 : 1;
  const p = entry.peak;
  if (p && typeof p.rate === "number") {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: p.tz ?? "UTC", hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(now);
    const hour = Number(parts.find((x) => x.type === "hour")?.value);
    const day = parts.find((x) => x.type === "weekday")?.value ?? "";
    const weekend = day === "Sat" || day === "Sun";
    const from = p.from ?? 0, to = p.to ?? 24;
    const inPeak = hour >= from && hour < to && !(p.weekdays !== false && weekend);
    factor *= inPeak ? p.rate : p.offRate ?? 1;
  }
  return factor;
}
