/**
 * Unit tests for the OpenCode adapter, renderer, and ANSI converter.
 *
 * These tests exercise the pure, runtime-independent core of the plugin:
 *   1. adaptSession — opencode SessionInfo → CoreRenderInput
 *   2. renderStatusLine — CoreRenderInput → ANSI string (via @statusline/core)
 *   3. ansiToSpans — ANSI string → coloured spans (for opentui)
 *
 * No OpenCode installation is required; mock SessionInfo / ModelInfo
 * objects stand in for the host data.
 */

import { describe, it, expect } from "vitest";
import { adaptSession, type CoreRenderInput } from "../src/adapter.js";
import { renderStatusLine } from "../src/render.js";
import { ansiToSpans, spansToPlainText } from "../src/ansi.js";
import type { SessionInfo, ModelInfo, ModelRef, VcsInfo } from "../src/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MODEL_REF: ModelRef = {
  id: "anthropic/claude-sonnet-4",
  providerID: "anthropic",
};

const MODEL_INFO: ModelInfo = {
  id: "anthropic/claude-sonnet-4",
  modelID: "claude-sonnet-4",
  providerID: "anthropic",
  name: "Claude Sonnet 4",
  limit: { context: 200_000, output: 8192 },
  cost: [
    {
      input: 3,
      output: 15,
      cache: { read: 0.3, write: 3.75 },
    },
  ],
  variants: [],
};

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: "sess-001",
    model: MODEL_REF,
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

const VCS: VcsInfo = { provider: "git", branch: "feature/auth" };

// ---------------------------------------------------------------------------
// adaptSession
// ---------------------------------------------------------------------------

describe("adaptSession", () => {
  it("maps model name and id from the resolved ModelInfo", () => {
    const session = makeSession();
    const result = adaptSession(session, {
      resolveModel: () => MODEL_INFO,
    });
    expect(result.model.name).toBe("Claude Sonnet 4");
    expect(result.model.id).toBe("anthropic/claude-sonnet-4");
  });

  it("falls back to the model ref id when ModelInfo is unavailable", () => {
    const session = makeSession();
    const result = adaptSession(session, { resolveModel: () => undefined });
    expect(result.model.name).toBe("anthropic/claude-sonnet-4");
    expect(result.model.id).toBe("anthropic/claude-sonnet-4");
  });

  it("computes context percentage from tokens vs context limit", () => {
    const session = makeSession({
      tokens: { input: 100_000, output: 20_000, reasoning: 0, cache: { read: 0, write: 0 } },
    });
    const result = adaptSession(session, { resolveModel: () => MODEL_INFO });
    // (100000 + 20000) / 200000 * 100 = 60
    expect(result.context.percentage).toBe(60);
    expect(result.context.tokensUsed).toBe(120_000);
    expect(result.context.tokensTotal).toBe(200_000);
  });

  it("caps percentage at 100 when tokens exceed context limit", () => {
    const session = makeSession({
      tokens: { input: 250_000, output: 10_000, reasoning: 0, cache: { read: 0, write: 0 } },
    });
    const result = adaptSession(session, { resolveModel: () => MODEL_INFO });
    expect(result.context.percentage).toBe(100);
  });

  it("returns null percentage when context limit is zero", () => {
    const session = makeSession();
    const result = adaptSession(session, {
      resolveModel: () => ({ ...MODEL_INFO, limit: { context: 0, output: 0 } }),
    });
    expect(result.context.percentage).toBeNull();
  });

  it("maps session cost to both session and total", () => {
    const session = makeSession({ cost: 1.58 });
    const result = adaptSession(session, { resolveModel: () => MODEL_INFO });
    expect(result.cost.session).toBe(1.58);
    expect(result.cost.total).toBe(1.58);
  });

  it("sets cache to null (opencode does not expose cache lifecycle)", () => {
    const result = adaptSession(makeSession(), { resolveModel: () => MODEL_INFO });
    expect(result.cache).toBeNull();
  });

  it("sets rateLimits to empty (opencode does not expose rate-limit windows)", () => {
    const result = adaptSession(makeSession(), { resolveModel: () => MODEL_INFO });
    expect(result.rateLimits).toEqual([]);
  });

  it("sets overhead.show to false (no recache tokens)", () => {
    const result = adaptSession(makeSession(), { resolveModel: () => MODEL_INFO });
    expect(result.overhead.show).toBe(false);
  });

  it("maps VCS branch to worktree name when present", () => {
    const result = adaptSession(makeSession(), {
      resolveModel: () => MODEL_INFO,
      vcs: VCS,
    });
    expect(result.worktree).toEqual({ name: "feature/auth" });
  });

  it("sets worktree to null when VCS is absent", () => {
    const result = adaptSession(makeSession(), {
      resolveModel: () => MODEL_INFO,
      vcs: undefined,
    });
    expect(result.worktree).toBeNull();
  });

  it("excludes cache/reasoning tokens from usage total", () => {
    const session = makeSession({
      tokens: { input: 10_000, output: 5_000, reasoning: 2_000, cache: { read: 50_000, write: 3_000 } },
    });
    const result = adaptSession(session, { resolveModel: () => MODEL_INFO });
    // usage = input + output only (matches legacy semantics)
    expect(result.usage.totalTokens).toBe(15_000);
  });
});

// ---------------------------------------------------------------------------
// renderStatusLine (full @statusline/core pipeline)
// ---------------------------------------------------------------------------

describe("renderStatusLine", () => {
  function makeInput(overrides: Partial<CoreRenderInput> = {}): CoreRenderInput {
    const base = adaptSession(makeSession(), { resolveModel: () => MODEL_INFO });
    return { ...base, ...overrides };
  }

  it("produces a non-empty ANSI string", () => {
    const ansi = renderStatusLine(makeInput(), { width: 120 });
    expect(typeof ansi).toBe("string");
    expect(ansi.length).toBeGreaterThan(0);
  });

  it("includes the model display name in the output", () => {
    const ansi = renderStatusLine(makeInput(), { width: 120 });
    expect(ansi).toContain("Claude Sonnet 4");
  });

  it("includes the context percentage", () => {
    const input = makeInput({
      context: { percentage: 60, tokensUsed: 120_000, tokensTotal: 200_000 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    expect(ansi).toContain("60%");
  });

  it("includes the session cost", () => {
    const input = makeInput({
      cost: { session: 1.58, total: 1.58 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    expect(ansi).toContain("$1.6");
  });

  it("emits ANSI colour escape sequences", () => {
    const input = makeInput({
      context: { percentage: 85, tokensUsed: 170_000, tokensTotal: 200_000 },
    });
    const ansi = renderStatusLine(input, { width: 120 });
    // High context → red colour code \x1b[31m
    // eslint-disable-next-line no-control-regex
    expect(ansi).toContain("\x1b[31m");
  });

  it("respects width constraint by shrinking sections", () => {
    const wide = renderStatusLine(makeInput(), { width: 200, widthConstrained: true });
    const narrow = renderStatusLine(makeInput(), { width: 40, widthConstrained: true });
    // Narrow output should be shorter (or equal) than wide output.
    expect(stripAnsi(narrow).length).toBeLessThanOrEqual(stripAnsi(wide).length);
  });

  it("shows all sections when width is unconstrained", () => {
    const ansi = renderStatusLine(makeInput(), { widthConstrained: false, width: 0 });
    expect(ansi).toContain("Claude Sonnet 4");
    expect(ansi).toContain("42¢");
  });

  it("uses default opencode sections (model, context, cost, tokens) when none specified", () => {
    const ansi = renderStatusLine(makeInput(), { sections: null });
    // Model and cost should be present; rate-limits should NOT (opencode has no data).
    expect(ansi).toContain("Claude Sonnet 4");
    expect(ansi).toContain("42¢");
    expect(ansi).not.toContain("5h");
    expect(ansi).not.toContain("7d");
  });
});

// ---------------------------------------------------------------------------
// ansiToSpans
// ---------------------------------------------------------------------------

describe("ansiToSpans", () => {
  it("returns a single plain span for uncoloured text", () => {
    const spans = ansiToSpans("hello world");
    expect(spans).toHaveLength(1);
    expect(spans[0].text).toBe("hello world");
    expect(spans[0].fg).toBeUndefined();
  });

  it("splits on colour changes", () => {
    // eslint-disable-next-line no-control-regex
    const input = "\x1b[32mgreen\x1b[0m plain \x1b[31mred\x1b[0m";
    const spans = ansiToSpans(input);
    expect(spans.map((s) => s.text)).toEqual(["green", " plain ", "red"]);
    expect(spans[0].fg).toBe("#69db7c"); // green
    expect(spans[1].fg).toBeUndefined(); // reset
    expect(spans[2].fg).toBe("#ff6b6b"); // red
  });

  it("maps dim (SGR 2) to a muted style", () => {
    // eslint-disable-next-line no-control-regex
    const input = "\x1b[2mdim text\x1b[0m";
    const spans = ansiToSpans(input);
    expect(spans[0].dim).toBe(true);
    expect(spans[0].bold).toBe(false);
  });

  it("maps bold (SGR 1) to bold style", () => {
    // eslint-disable-next-line no-control-regex
    const input = "\x1b[1mbold\x1b[0m";
    const spans = ansiToSpans(input);
    expect(spans[0].bold).toBe(true);
  });

  it("resets bold and dim with SGR 22", () => {
    // eslint-disable-next-line no-control-regex
    const input = "\x1b[1mbold\x1b[22mnormal";
    const spans = ansiToSpans(input);
    expect(spans[0].bold).toBe(true);
    expect(spans[1].bold).toBe(false);
  });

  it("handles empty SGR (treated as reset)", () => {
    // eslint-disable-next-line no-control-regex
    const input = "\x1b[32mgreen\x1b[mplain";
    const spans = ansiToSpans(input);
    expect(spans[0].fg).toBe("#69db7c");
    expect(spans[1].fg).toBeUndefined();
  });

  it("strips non-SGR escape sequences", () => {
    // \x1b[2J is a clear-screen escape (not SGR); it should be stripped,
    // leaving the surrounding plain text intact.
    // eslint-disable-next-line no-control-regex
    const input = "a\x1b[2Jb";
    const spans = ansiToSpans(input);
    expect(spansToPlainText(spans)).toBe("ab");
  });

  it("round-trips through renderStatusLine producing valid spans", () => {
    const input = adaptSession(makeSession(), { resolveModel: () => MODEL_INFO });
    const ansi = renderStatusLine(input, { width: 120 });
    const spans = ansiToSpans(ansi);
    // Should produce multiple spans (model is cyan, context has colours, etc.)
    expect(spans.length).toBeGreaterThan(1);
    // Plain text should still contain the model name and cost.
    const plain = spansToPlainText(spans);
    expect(plain).toContain("Claude Sonnet 4");
    expect(plain).toContain("42¢");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}
