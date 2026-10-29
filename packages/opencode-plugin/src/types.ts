/**
 * Minimal type stubs for the OpenCode plugin host environment.
 *
 * These mirror the runtime shapes published by `@opencode/plugin/tui`,
 * `@opencode/client`, and `@opentui/solid` but are declared locally so the
 * plugin can be type-checked and unit-tested without installing the full
 * OpenCode stack as a hard dependency. At runtime, the real types are
 * provided by the host (OpenCode TUI loads the plugin in-process).
 *
 * Source of truth:
 *   https://github.com/sst/opencode — packages/plugin/src/tui/context.ts
 *   packages/client/src/promise/generated/types.ts
 */

/** USD amount as a plain number. */
export type MoneyUSD = number;

/** Model reference stored on a session. */
export interface ModelRef {
  readonly id: string;
  readonly providerID: string;
  readonly variant?: string;
}

/** Token usage snapshot for a session. */
export interface TokenUsageInfo {
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cache: { readonly read: number; readonly write: number };
}

/** A resolved model definition (from data.model.list()). */
export interface ModelInfo {
  readonly id: string;
  readonly modelID: string;
  readonly providerID: string;
  readonly name: string;
  readonly limit: { readonly context: number; readonly input?: number; readonly output: number };
  readonly cost?: ReadonlyArray<{
    readonly input: number;
    readonly output: number;
    readonly cache: { readonly read: number; readonly write: number };
  }>;
  readonly variants?: ReadonlyArray<{ readonly id: string }>;
}

/** Session record. */
export interface SessionInfo {
  readonly id: string;
  readonly model?: ModelRef;
  readonly cost: MoneyUSD;
  readonly tokens: TokenUsageInfo;
  readonly time: { readonly created: number; readonly updated: number };
  readonly title?: string;
}

/** VCS info for the current workspace. */
export interface VcsInfo {
  readonly provider?: string;
  readonly branch: string;
}

/** Input passed to a prompt.footer.status slot claim render. */
export interface PromptFooterInput {
  readonly sessionID?: string;
  readonly mode: "normal" | "shell";
  readonly showDetails: boolean;
}

/** Subset of the OpenCode TUI plugin context used by this plugin. */
export interface OpenCodePluginContext {
  readonly data: {
    readonly on: (
      type: string,
      handler: (event: { readonly details: unknown }) => void,
    ) => () => void;
    readonly session: {
      get(sessionID: string): SessionInfo | undefined;
      cost(sessionID: string): number;
      readonly message: {
        list(sessionID: string): ReadonlyArray<{
          readonly tokens?: Partial<TokenUsageInfo>;
        }>;
      };
    };
    readonly model: {
      list(): ReadonlyArray<ModelInfo>;
    };
    readonly location: {
      readonly vcs: {
        info(): VcsInfo | undefined;
      };
    };
  };
  readonly ui: {
    readonly slot: (claim: {
      readonly replace?: "prompt.footer.status" | "home.footer.status";
      readonly append?: "prompt.footer.status" | "home.footer.status";
      readonly render: (input: PromptFooterInput) => unknown;
    }) => () => void;
  };
  readonly renderer: {
    readonly width: number;
  };
}
