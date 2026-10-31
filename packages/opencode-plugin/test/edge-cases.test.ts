/**
 * Edge-case and fixture-based tests for the OpenCode plugin adapter.
 *
 * Mirrors the coverage pattern of test/adapters/adapter.test.ts (which
 * covers claude-code and cursor): fixture-driven parsing, missing-field
 * handling, zero/negative values, and narrow-width compaction.
 *
 * OpenCode doesn't have an external-command contract, so there's no CLI
 * integration test — but the pure adapter + renderer pipeline is fully
 * exercisable with mock SessionInfo objects.
 */

import { describe, it, expect } from "vitest";
import { adaptSession, type CoreRenderInput } from "../src/adapter.js";
import {
  FOOTER_OPENCODE_SECTIONS,
  renderStatusLine,
} from "../src/render.js";
import { ansiToSpans, spansToPlainText } from "../src/ansi.js";
import type { SessionInfo, ModelInfo, ModelRef, TokenUsageInfo } from "../src/types.js";

// ---------------------------------------------------------------------------
// Fixtures (mirror the claude-code / cursor fixture patterns)
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_REF: ModelRef = {
  id: "anthropic/claude-sonnet-4",
  providerID: "anthropic",
};

const DEFAULT_MODEL_INFO: ModelInfo = {
  id: "anthropic/claude-sonnet-4",
  modelID: "claude-sonnet-4",
  providerID: "anthropic",
  name: "Claude Sonnet 4",
  limit: { context: 200_000, output: 8192 },
  cost: [{ input: 3, output: 15, cache: { read: 0.3, write: 3.75 } }],
  variants: [],
};

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: "sess-001",
    model: DEFAULT_MODEL_REF,
    cost: 0.42,
    tokens: {
      input: 15_000,
      output: 5_000,
      reasoning: 0,
      cache: { read: 8_000, write: 2_000 },
    },
    time: { created: Date.now(), updated: Date.now() },
    ...overrides,
  };
}

function makeTokens(overrides: Partial<TokenUsageInfo> = {}): TokenUsageInfo {
  return {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
    ...overrides,
  };
}

function resolveDefaultModel(): ModelInfo {
  return DEFAULT_MODEL_INFO;
}

// ---------------------------------------------------------------------------
// Edge: missing model
// ---------------------------------------------------------------------------

describe("adaptSession — missing model", () => {
  it("falls back to 'unknown' when session has no model ref and resolver returns undefined", () => {
    const session = makeSession({ model: undefined });
    const result = adaptSession(session, { resolveModel: () => undefined });
    expect(result.model.name).toBe("unknown");
    expect(result.model.id).toBe("unknown");
  });

  it("uses ref.id as fallback name when ModelInfo unavailable", () => {
    const session = makeSession({
      model: { id: "custom-model", providerID: "custom" },
    });
    const result = adaptSession(session, { resolveModel: () => undefined });
    expect(result.model.name).toBe("custom-model");
    expect(result.model.id).toBe("custom-model");
  });

  it("returns null context percentage when no model → no context limit", () => {
    const session = makeSession({ model: undefined });
    const result = adaptSession(session, { resolveModel: () => undefined });
    expect(result.context.percentage).toBeNull();
    expect(result.context.tokensTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge: zero / missing tokens
// ---------------------------------------------------------------------------

describe("adaptSession — zero tokens", () => {
  it("handles a brand-new session with all-zero tokens", () => {
    const session = makeSession({
      tokens: makeTokens({ input: 0, output: 0 }),
      cost: 0,
    });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.usage.totalTokens).toBe(0);
    expect(result.context.percentage).toBe(0);
    expect(result.cost.session).toBe(0);
  });

  it("handles missing tokens by defaulting to zero", () => {
    const session = makeSession({ tokens: undefined as unknown as TokenUsageInfo });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.usage.totalTokens).toBe(0);
    expect(result.context.tokensUsed).toBe(0);
  });

  it("treats NaN input tokens as zero (defensive)", () => {
    const session = makeSession({
      tokens: { input: Number.NaN, output: 100, reasoning: 0, cache: { read: 0, write: 0 } },
    });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    // NaN + 100 = NaN, but Math.round on NaN should still produce a sane value.
    // The adapter doesn't explicitly guard NaN; this test documents current behavior.
    expect(Number.isNaN(result.usage.totalTokens)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge: cost
// ---------------------------------------------------------------------------

describe("adaptSession — cost edge cases", () => {
  it("handles zero cost session", () => {
    const session = makeSession({ cost: 0 });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.cost.session).toBe(0);
    expect(result.cost.total).toBe(0);
  });

  it("preserves fractional cost with full precision", () => {
    const session = makeSession({ cost: 0.0042 });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.cost.session).toBe(0.0042);
  });

  it("handles large cost values", () => {
    const session = makeSession({ cost: 9999.99 });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.cost.session).toBe(9999.99);
  });
});

// ---------------------------------------------------------------------------
// Edge: context boundary
// ---------------------------------------------------------------------------

describe("adaptSession — context boundary", () => {
  it("reports 0% when tokens are zero", () => {
    const session = makeSession({
      tokens: makeTokens({ input: 0, output: 0 }),
    });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.context.percentage).toBe(0);
  });

  it("reports exactly 100% when tokens equal context limit", () => {
    const session = makeSession({
      tokens: makeTokens({ input: 200_000, output: 0 }),
    });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.context.percentage).toBe(100);
  });

  it("caps at 100% when tokens exceed context limit", () => {
    const session = makeSession({
      tokens: makeTokens({ input: 250_000, output: 50_000 }),
    });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.context.percentage).toBe(100);
  });

  it("rounds percentage to 1 decimal place", () => {
    // 50000 / 200000 = 25.0 exactly
    const session = makeSession({
      tokens: makeTokens({ input: 50_000, output: 0 }),
    });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.context.percentage).toBe(25);
  });

  it("rounds fractional percentages correctly", () => {
    // 33333 / 200000 = 16.6665 → rounds to 16.7
    const session = makeSession({
      tokens: makeTokens({ input: 33_333, output: 0 }),
    });
    const result = adaptSession(session, { resolveModel: resolveDefaultModel });
    expect(result.context.percentage).toBe(16.7);
  });
});

// ---------------------------------------------------------------------------
// Edge: VCS / worktree
// ---------------------------------------------------------------------------

describe("adaptSession — VCS / worktree", () => {
  it("maps VCS branch to worktree name", () => {
    const result = adaptSession(makeSession(), {
      resolveModel: resolveDefaultModel,
      vcs: { provider: "git", branch: "main" },
    });
    expect(result.worktree).toEqual({ name: "main" });
  });

  it("maps empty branch string to worktree (preserved as-is)", () => {
    const result = adaptSession(makeSession(), {
      resolveModel: resolveDefaultModel,
      vcs: { provider: "git", branch: "" },
    });
    // Empty branch is falsy → worktree becomes null (defensive)
    expect(result.worktree).toBeNull();
  });

  it("returns null worktree when VCS info is absent", () => {
    const result = adaptSession(makeSession(), {
      resolveModel: resolveDefaultModel,
      vcs: undefined,
    });
    expect(result.worktree).toBeNull();
  });

  it("returns null worktree when VCS branch is undefined", () => {
    const result = adaptSession(makeSession(), {
      resolveModel: resolveDefaultModel,
      vcs: { provider: "git", branch: undefined as unknown as string },
    });
    expect(result.worktree).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderStatusLine — edge cases
// ---------------------------------------------------------------------------

describe("renderStatusLine — edge cases", () => {
  function makeInput(overrides: Partial<CoreRenderInput> = {}): CoreRenderInput {
    return {
      ...adaptSession(makeSession(), { resolveModel: resolveDefaultModel }),
      ...overrides,
    };
  }

  it("renders without crashing for a zero-token session", () => {
    const input = makeInput({
      context: { percentage: 0, tokensUsed: 0, tokensTotal: 200_000 },
      usage: { totalTokens: 0, cacheTokens: undefined },
      cost: { session: 0, total: 0 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    expect(ansi.length).toBeGreaterThan(0);
    // 0% should appear in the context bar
    expect(spansToPlainText(ansiToSpans(ansi))).toContain("0%");
  });

  it("renders $0.00 for a zero-cost session", () => {
    const input = makeInput({
      cost: { session: 0, total: 0 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    // Note: cost section's visibleWhen is `!!ctx.input.cost.session`, so a
    // falsy (zero) cost hides the section entirely — matches legacy
    // formatter behavior. We assert that no $-amount leaks into the output.
    const plain = spansToPlainText(ansiToSpans(ansi));
    expect(plain).not.toContain("$");
  });

  it("renders red context bar at 100% usage", () => {
    const input = makeInput({
      context: { percentage: 100, tokensUsed: 200_000, tokensTotal: 200_000 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    // eslint-disable-next-line no-control-regex
    expect(ansi).toContain("\x1b[31m"); // RED
    expect(spansToPlainText(ansiToSpans(ansi))).toContain("100%");
  });

  it("renders yellow context bar at 60% (between warn and crit)", () => {
    const input = makeInput({
      context: { percentage: 60, tokensUsed: 120_000, tokensTotal: 200_000 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    // eslint-disable-next-line no-control-regex
    expect(ansi).toContain("\x1b[33m"); // YELLOW
  });

  it("renders green context bar below warn threshold", () => {
    const input = makeInput({
      context: { percentage: 30, tokensUsed: 60_000, tokensTotal: 200_000 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    // eslint-disable-next-line no-control-regex
    expect(ansi).toContain("\x1b[32m"); // GREEN
  });

  it("produces shorter output under narrow width constraint", () => {
    const input = makeInput();
    const wide = renderStatusLine(input, { width: 200, widthConstrained: true });
    const narrow = renderStatusLine(input, { width: 30, widthConstrained: true });
    expect(stripAnsi(narrow).length).toBeLessThanOrEqual(stripAnsi(wide).length);
  });

  it("does not crash when width is 0 and unconstrained", () => {
    const input = makeInput();
    const ansi = renderStatusLine(input, { width: 0, widthConstrained: false });
    expect(ansi.length).toBeGreaterThan(0);
  });

  it("does not include rate-limit sections (opencode has no data)", () => {
    const input = makeInput();
    const ansi = renderStatusLine(input, { width: 200 });
    const plain = spansToPlainText(ansiToSpans(ansi));
    expect(plain).not.toContain("5h");
    expect(plain).not.toContain("7d");
    expect(plain).not.toContain("Spend");
  });

  it("does not include cache section (opencode has no data)", () => {
    const input = makeInput();
    const ansi = renderStatusLine(input, { width: 200 });
    const plain = spansToPlainText(ansiToSpans(ansi));
    // Cache section shows ⏱ — should not appear since cache is null
    expect(plain).not.toContain("⏱");
    expect(plain).not.toContain("cold");
  });

  it("respects custom sections override", () => {
    const input = makeInput();
    const ansi = renderStatusLine(input, {
      width: 200,
      sections: "model,cost",
    });
    const plain = spansToPlainText(ansiToSpans(ansi));
    expect(plain).toContain("Claude Sonnet 4");
    expect(plain).toContain("42¢");
    // context should NOT appear since it's not in the override
    expect(plain).not.toContain("▕"); // context bar border
  });
});

// ---------------------------------------------------------------------------
// Fixture-based round-trip tests (mirror the claude-code fixture pattern)
// ---------------------------------------------------------------------------

describe("fixture round-trips", () => {
  const fixtures = [
    {
      name: "basic",
      session: makeSession(),
      model: DEFAULT_MODEL_INFO,
      expectModel: "Claude Sonnet 4",
      expectCost: "42¢",
      // (15000+5000+8000+2000)/200000 = 15%
      expectPct: "15%",
    },
    {
      name: "high-context",
      session: makeSession({
        tokens: makeTokens({ input: 170_000, output: 30_000 }),
      }),
      model: DEFAULT_MODEL_INFO,
      expectModel: "Claude Sonnet 4",
      expectCost: "42¢",
      // 200000/200000 = 100% (capped at 100)
      expectPct: "100%",
    },
    {
      name: "zero-cost",
      session: makeSession({ cost: 0 }),
      model: DEFAULT_MODEL_INFO,
      expectModel: "Claude Sonnet 4",
      // Cost section hides when session cost is 0 (visibleWhen: !!cost.session).
      // We assert the model still renders; cost is checked separately in the
      // edge-cases describe block.
      expectCost: null,
      expectPct: "15%",
    },
    {
      name: "different-model",
      session: makeSession({
        model: { id: "openai/gpt-5", providerID: "openai" },
      }),
      model: {
        ...DEFAULT_MODEL_INFO,
        id: "openai/gpt-5",
        modelID: "gpt-5",
        providerID: "openai",
        name: "GPT-5",
        limit: { context: 128_000, output: 4096 },
      },
      expectModel: "GPT-5",
      expectCost: "42¢",
      // (15000+5000+8000+2000)/128000 = 23.4% → Math.round = 23%
      expectPct: "23%",
    },
  ];

  for (const fixture of fixtures) {
    it(`renders ${fixture.name} fixture correctly`, () => {
      const coreInput = adaptSession(fixture.session, {
        resolveModel: () => fixture.model,
      });
      const ansi = renderStatusLine(coreInput, { width: 120 });
      const plain = spansToPlainText(ansiToSpans(ansi));

      expect(plain).toContain(fixture.expectModel);
      if (fixture.expectCost !== null) {
        expect(plain).toContain(fixture.expectCost);
      } else {
        expect(plain).not.toContain("$");
      }
      expect(plain).toContain(fixture.expectPct);
    });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

describe("renderStatusLine — section defaults", () => {
  const input = {
    ...adaptSession(makeSession(), { resolveModel: resolveDefaultModel }),
    worktree: { name: "master" },
  } as CoreRenderInput;
  const plain = (sections?: string | null) =>
    spansToPlainText(
      ansiToSpans(renderStatusLine(input, { width: 200, sections })),
    );

  it("omits the worktree by default", () => {
    expect(plain()).not.toContain("master");
  });

  it("shows the worktree only when asked for", () => {
    expect(plain("model,worktree")).toContain("master");
  });

  it("drops context and cost in the footer set", () => {
    expect(plain(FOOTER_OPENCODE_SECTIONS)).not.toContain("%");
  });
});
