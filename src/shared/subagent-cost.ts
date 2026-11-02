// Claude Code's cost.total_cost_usd leaves out sub-agents; their usage only lives in
// <transcript dir>/<session id>/subagents/*.jsonl, so price it from there.

import { promises as fs } from "fs";
import { dirname, join } from "path";
import type { PriceTable } from "./types.js";
import type { UnifiedStatusInput } from "./unified-model.js";

/** "claude-haiku-5-5" (optionally dated) -> "Claude Haiku 5.5", the price table's key. */
function priceKey(modelId: string): string | null {
  const m = modelId.match(/^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2}))?(?:-|$)/);
  if (!m) return null;
  const name = m[1][0].toUpperCase() + m[1].slice(1);
  return `Claude ${name} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}

function messageCost(model: string, u: Usage, prices: PriceTable): number {
  const key = priceKey(model);
  const p = key ? prices.models[key] : undefined;
  if (!p) return 0;
  const w5 = u.cache_creation?.ephemeral_5m_input_tokens;
  const w1 = u.cache_creation?.ephemeral_1h_input_tokens;
  const hasSplit = w5 !== undefined || w1 !== undefined;
  const write5 = hasSplit ? (w5 ?? 0) : (u.cache_creation_input_tokens ?? 0);
  const write1 = hasSplit ? (w1 ?? 0) : 0;
  return (
    (u.input_tokens ?? 0) * p.in +
    (u.output_tokens ?? 0) * p.out +
    (u.cache_read_input_tokens ?? 0) * p.in * 0.1 +
    write5 * p.in * 1.25 +
    write1 * p.in * 2
  ) / 1e6;
}

/** USD spent by this session's sub-agents, priced from their transcripts. */
export async function subagentCostUsd(transcriptPath: string, sessionId: string, prices: PriceTable): Promise<number> {
  const dir = join(dirname(transcriptPath), sessionId, "subagents");
  let names: string[];
  try { names = (await fs.readdir(dir)).filter((n) => n.endsWith(".jsonl")); } catch { return 0; }

  const seen = new Set<string>();
  let total = 0;
  for (const n of names) {
    let text: string;
    try { text = await fs.readFile(join(dir, n), "utf8"); } catch { continue; }
    for (const l of text.split("\n")) {
      if (!l.includes('"usage"')) continue;
      try {
        const msg = JSON.parse(l)?.message;
        if (!msg?.usage || typeof msg.model !== "string") continue;
        if (msg.id) {
          if (seen.has(msg.id)) continue;
          seen.add(msg.id);
        }
        total += messageCost(msg.model, msg.usage, prices);
      } catch { /* ignore */ }
    }
  }
  return total;
}

/** Fold sub-agent spend into the session cost Claude Code reported. */
export async function addSubagentCost(
  input: UnifiedStatusInput,
  transcriptPath: string,
  prices: PriceTable,
): Promise<UnifiedStatusInput> {
  const extra = await subagentCostUsd(transcriptPath, input.sessionId, prices);
  if (extra <= 0) return input;
  const bump = (v: number | null | undefined) => (v ?? 0) + extra;
  return { ...input, cost: { ...input.cost, sessionCostUsd: bump(input.cost.sessionCostUsd), totalCostUsd: bump(input.cost.totalCostUsd) } };
}
