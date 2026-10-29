/**
 * Adapter: converts OpenCode session/model data into the CoreRenderInput
 * shape that `@statusline/core` sections expect.
 *
 * This is a pure function — no I/O, no side effects — so it can be unit
 * tested in isolation without an OpenCode runtime.
 *
 * OpenCode exposes session cost, token usage, and model metadata via its
 * plugin context. Notably, it does NOT expose:
 *   - prompt cache TTL / warm / expiry / hit-ratio (no cache section)
 *   - rate-limit windows (no resets section)
 *   - recache tokens (no overhead section)
 *   - vim mode / worktree (no vim/worktree sections)
 *
 * What we DO render: model name, context usage bar, token count, session
 * cost. This is the subset of the legacy status line that OpenCode's data
 * model supports.
 */

import type {
  ModelInfo,
  ModelRef,
  SessionInfo,
  TokenUsageInfo,
  VcsInfo,
} from "./types.js";

/**
 * The input shape consumed by `@statusline/core` sections.
 *
 * Mirrors the structure produced by `adaptInputForCore()` in
 * `src/formatter.ts` so the same section factories (model, context, cost,
 * usage) work unchanged.
 */
export interface CoreRenderInput {
  readonly model: {
    readonly name: string;
    readonly effort: string | null;
    readonly costMultiplier: number | null;
    readonly id: string;
  };
  readonly context: {
    readonly percentage: number | null;
    readonly tokensUsed: number;
    readonly tokensTotal: number;
  };
  readonly cost: {
    readonly session: number;
    readonly total: number;
  };
  readonly cache: null;
  readonly rateLimits: readonly never[];
  readonly overhead: { readonly show: false };
  readonly usage: {
    readonly totalTokens: number;
    readonly cacheTokens: undefined;
  };
  readonly vim: null;
  readonly worktree: { readonly name: string } | null;
  readonly cursorExtensions: null;
}

export interface AdaptOptions {
  /**
   * Called to resolve a ModelRef (from the session) to a full ModelInfo
   * (which carries the context limit and display name). In the plugin
   * this delegates to `data.model.list()`; in tests it can be stubbed.
   */
  readonly resolveModel: (ref: ModelRef) => ModelInfo | undefined;
  /** Optional VCS info for the worktree section. */
  readonly vcs?: VcsInfo | undefined;
}

/**
 * Adapt an OpenCode session into a CoreRenderInput for @statusline/core.
 *
 * @throws if the session is missing or the model cannot be resolved.
 */
export function adaptSession(
  session: SessionInfo,
  options: AdaptOptions,
): CoreRenderInput {
  const ref = session.model;
  const modelInfo = ref ? options.resolveModel(ref) : undefined;

  const modelName = modelInfo?.name ?? ref?.id ?? "unknown";
  const modelId = modelInfo?.id ?? ref?.id ?? "unknown";

  // Context: opencode doesn't expose a pre-computed used_percentage, so we
  // derive it from token totals vs the model's context limit.
  const tokensUsed = sumTokens(session.tokens);
  const tokensTotal = modelInfo?.limit.context ?? 0;
  const percentage =
    tokensTotal > 0 ? Math.min(100, (tokensUsed / tokensTotal) * 100) : null;

  return {
    model: {
      name: modelName,
      effort: null,
      costMultiplier: null,
      id: modelId,
    },
    context: {
      percentage: roundTo(percentage, 1),
      tokensUsed,
      tokensTotal,
    },
    cost: {
      session: session.cost,
      total: session.cost,
    },
    // OpenCode does not expose prompt-cache lifecycle data.
    cache: null,
    rateLimits: [],
    overhead: { show: false },
    usage: {
      totalTokens: tokensUsed,
      cacheTokens: undefined,
    },
    vim: null,
    worktree: options.vcs?.branch ? { name: options.vcs.branch } : null,
    cursorExtensions: null,
  };
}

/** Sum input + output tokens (cache/reasoning excluded to match legacy semantics).
 *  Defensive against missing fields — OpenCode may emit partial token records. */
function sumTokens(tokens: TokenUsageInfo | undefined | null): number {
  if (!tokens) return 0;
  return (tokens.input ?? 0) + (tokens.output ?? 0);
}

/** Round to `digits` decimal places, returning null for null input. */
function roundTo(value: number | null, digits: number): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
