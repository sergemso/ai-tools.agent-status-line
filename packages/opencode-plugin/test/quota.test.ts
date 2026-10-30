import { describe, expect, it } from "vitest";
import {
  fetchProviderQuota,
  parseQuotaResponse,
  pickCredentialKey,
  supportsProviderQuota,
  type CredentialEntry,
} from "../src/quota.js";

/** The live shape observed from GET https://api.z.ai/api/monitor/usage/quota/limit */
const ZAI_RESPONSE = {
  code: 200,
  msg: "Operation successful",
  data: {
    limits: [
      {
        type: "CREDIT_LIMIT",
        unit: 3,
        number: 5,
        usage: 2000,
        currentValue: 58,
        remaining: 1941,
        percentage: 2,
        nextResetTime: 1793401862631,
      },
      {
        type: "CREDIT_LIMIT",
        unit: 6,
        number: 1,
        usage: 10000,
        currentValue: 58,
        remaining: 9941,
        percentage: 1,
        nextResetTime: 1793988432998,
      },
    ],
    level: "lite",
  },
  success: true,
};

const NOW = 1793366400000; // fixed epoch ms for window-id derivation

describe("parseQuotaResponse", () => {
  it("maps z.ai credit limits to core windows", () => {
    const windows = parseQuotaResponse(ZAI_RESPONSE, NOW);
    expect(windows).toEqual([
      // ~9.8h until reset → 1d window
      { window: "1d", limit: 2000, remaining: 1941, resetsAt: 1793401862 },
      // ~7.2d until reset → 7d window
      { window: "7d", limit: 10000, remaining: 9941, resetsAt: 1793988432 },
    ]);
  });

  it("skips entries without usable numbers", () => {
    const windows = parseQuotaResponse(
      { data: { limits: [{ type: "CREDIT_LIMIT" }, { usage: 5, remaining: 1 }] } },
      NOW,
    );
    expect(windows).toBeUndefined();
  });

  it("returns undefined for non-array payloads", () => {
    expect(parseQuotaResponse({ data: {} }, NOW)).toBeUndefined();
    expect(parseQuotaResponse(null, NOW)).toBeUndefined();
  });
});

describe("supportsProviderQuota", () => {
  it("knows z.ai and zhipu, not others", () => {
    expect(supportsProviderQuota("zai")).toBe(true);
    expect(supportsProviderQuota("zai-cn")).toBe(true);
    expect(supportsProviderQuota("zhipu")).toBe(true);
    expect(supportsProviderQuota("nvidia")).toBe(false);
  });
});

describe("fetchProviderQuota", () => {
  it("returns undefined for unknown providers", async () => {
    expect(await fetchProviderQuota("nvidia", "key", stubFetch(), NOW)).toBeUndefined();
  });

  it("returns undefined without a key", async () => {
    expect(await fetchProviderQuota("zai", "", stubFetch(), NOW)).toBeUndefined();
  });

  it("parses a successful response", async () => {
    const fetchImpl = stubFetch(ZAI_RESPONSE);
    const windows = await fetchProviderQuota("zai", "key", fetchImpl, NOW);
    expect(windows).toEqual(parseQuotaResponse(ZAI_RESPONSE, NOW));
  });

  it("swallows HTTP errors", async () => {
    const fetchImpl = stubFetch({ ok: false, status: 401 });
    expect(await fetchProviderQuota("zai", "key", fetchImpl, NOW)).toBeUndefined();
  });

  it("swallows network failures", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await fetchProviderQuota("zai", "key", fetchImpl, NOW)).toBeUndefined();
  });
});

describe("pickCredentialKey", () => {
  const entries: CredentialEntry[] = [
    { id: "1", integrationID: "zai", active: false, value: { type: "key", key: "old" } },
    { id: "2", integrationID: "nvidia", active: true, value: { type: "key", key: "nv" } },
    { id: "3", integrationID: "zai", active: true, value: { type: "key", key: "new" } },
  ];

  it("prefers the active key for the provider", () => {
    expect(pickCredentialKey(entries, "zai")).toBe("new");
  });

  it("falls back to the first key when none is active", () => {
    expect(
      pickCredentialKey(
        entries.map((e) => ({ ...e, active: false })),
        "zai",
      ),
    ).toBe("old");
  });

  it("returns undefined for unknown providers", () => {
    expect(pickCredentialKey(entries, "anthropic")).toBeUndefined();
  });
});

/** A fetch stub returning the given JSON body (or error status object). */
function stubFetch(body?: unknown): typeof fetch {
  return (async () =>
    body && typeof body === "object" && "ok" in body
      ? ({ ok: false, status: 401 } as Response)
      : ({ ok: true, json: async () => body }) as unknown as Response) as typeof fetch;
}
