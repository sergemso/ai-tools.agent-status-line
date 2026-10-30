/**
 * Provider quota windows — the OpenCode equivalent of Claude Code's
 * `rate_limits` statusline payload.
 *
 * OpenCode's plugin data API does not expose rate-limit windows, but for
 * some providers the quota can be fetched directly from the provider's
 * usage endpoint using the API key OpenCode has saved. The TUI plugin
 * resolves the active credential via `context.client.credential.list()`
 * and hands the key to `fetchProviderQuota`.
 *
 * This module is pure except for the injected `fetch` — unit tests pass a
 * stub. Supported providers:
 *
 *   - `zai`    → GET https://api.z.ai/api/monitor/usage/quota/limit
 *   - `zai-cn` → GET https://bigmodel.cn/api/monitor/usage/quota/limit
 *
 * Both share the same response shape (Authorization: <key>, no Bearer):
 *
 *   { "data": { "limits": [ { "type": "CREDIT_LIMIT", "unit": 3,
 *       "number": 5, "usage": 2000, "currentValue": 58,
 *       "remaining": 1941, "percentage": 2,
 *       "nextResetTime": 1793401862631 }, … ], "level": "lite" } }
 *
 * `usage` is the window's total quota, `remaining` what is left, and
 * `nextResetTime` an absolute epoch-millisecond timestamp.
 */

/** A quota window in the shape @statusline/core's rate-limits section wants. */
export interface QuotaWindow {
  readonly window: string;
  readonly limit: number;
  readonly remaining: number;
  readonly resetsAt: number;
}

/** Minimal credential entry shape returned by `client.credential.list()`. */
export interface CredentialEntry {
  readonly id: string;
  readonly integrationID: string;
  readonly active: boolean;
  readonly value?: { readonly type?: string; readonly key?: string };
}

type FetchLike = typeof fetch;

/** Providers whose usage endpoints we know how to query. */
const KNOWN_PROVIDERS: Record<string, string> = {
  zai: "https://api.z.ai/api/monitor/usage/quota/limit",
  "zai-cn": "https://bigmodel.cn/api/monitor/usage/quota/limit",
  zhipu: "https://bigmodel.cn/api/monitor/usage/quota/limit",
};

/** Whether quota windows can be fetched for this provider. */
export function supportsProviderQuota(providerID: string): boolean {
  return providerID in KNOWN_PROVIDERS;
}

/**
 * Fetch quota windows for a provider. Returns undefined when the provider
 * is unknown, the key is missing, or the endpoint fails — the resets
 * section is then simply omitted, matching the Claude Code behaviour for
 * accounts without rate limits.
 */
export async function fetchProviderQuota(
  providerID: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
  now: number = Date.now(),
): Promise<readonly QuotaWindow[] | undefined> {
  const endpoint = KNOWN_PROVIDERS[providerID];
  if (!endpoint || !apiKey) return undefined;

  let body: unknown;
  try {
    const response = await fetchImpl(endpoint, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return undefined;
    body = await response.json();
  } catch {
    return undefined;
  }
  return parseQuotaResponse(body, now);
}

/**
 * Parse a Z.ai / Zhipu quota response into core windows. Exported for
 * tests. Invalid entries are skipped; an empty/invalid payload yields
 * undefined so the section stays hidden rather than rendering zeros.
 */
export function parseQuotaResponse(
  body: unknown,
  now: number = Date.now(),
): readonly QuotaWindow[] | undefined {
  const limits = (body as { data?: { limits?: unknown[] } })?.data?.limits;
  if (!Array.isArray(limits)) return undefined;

  const windows: QuotaWindow[] = [];
  for (const raw of limits) {
    const entry = raw as Record<string, unknown>;
    const total = positiveNumber(entry.usage);
    const remaining = nonNegativeNumber(entry.remaining);
    const resetsAtMs = positiveNumber(entry.nextResetTime);
    if (total === undefined || remaining === undefined || resetsAtMs === undefined) {
      continue;
    }
    windows.push({
      window: windowId(resetsAtMs, now),
      limit: total,
      remaining,
      resetsAt: Math.floor(resetsAtMs / 1000),
    });
  }
  return windows.length > 0 ? windows : undefined;
}

/**
 * Pick the active key credential for a provider from OpenCode's list.
 * When several exist, the active one wins; otherwise the first key.
 */
export function pickCredentialKey(
  credentials: readonly CredentialEntry[],
  providerID: string,
): string | undefined {
  const matching = credentials.filter(
    (c) => c.integrationID === providerID && c.value?.type === "key" && c.value.key,
  );
  return (matching.find((c) => c.active) ?? matching[0])?.value?.key;
}

/** A short window id from the distance until reset ("5h", "1d", "7d", "30d"). */
function windowId(resetsAtMs: number, now: number): string {
  const seconds = (resetsAtMs - now) / 1000;
  if (seconds <= 0) return "now";
  if (seconds <= 26 * 3600) return "1d";
  if (seconds <= 8 * 86400) return "7d";
  if (seconds <= 32 * 86400) return "30d";
  return "90d";
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
