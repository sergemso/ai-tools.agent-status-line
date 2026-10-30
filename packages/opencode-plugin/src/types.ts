/**
 * Minimal type stubs for the OpenCode plugin host environment.
 *
 * These mirror the runtime shapes published by `@opencode/plugin/tui` and
 * `@opencode/client`, but are declared locally so the adapter and renderer
 * can be type-checked and unit-tested without installing the full OpenCode
 * stack. At runtime the real types are provided by the host.
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

/** Token usage snapshot for a session or assistant message. */
export interface TokenUsageInfo {
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cache: { readonly read: number; readonly write: number };
}

/** A resolved model definition (from data.location.model.list()). */
export interface ModelInfo {
  readonly id: string;
  readonly modelID: string;
  readonly providerID: string;
  readonly name: string;
  readonly limit: {
    readonly context: number;
    readonly input?: number;
    readonly output: number;
  };
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
  readonly location?: { readonly directory: string; readonly workspaceID?: string };
}

/** VCS branch descriptor. */
export interface VcsBranch {
  readonly current?: string;
  readonly default?: string;
}

/** VCS info for the current workspace. */
export interface VcsInfo {
  readonly provider?: string;
  /** OpenCode v2 exposes an object; older fixtures/tests used a string. */
  readonly branch: VcsBranch | string;
}

/** A single message in a session transcript. */
export interface SessionMessageInfo {
  readonly id: string;
  readonly type: string;
  readonly model?: ModelRef;
  readonly tokens?: TokenUsageInfo;
}

/** Input passed to a prompt.footer.status slot claim render. */
export interface PromptFooterInput {
  readonly sessionID?: string;
  readonly mode: "normal" | "shell";
  readonly showDetails: boolean;
}

/** Subset of the OpenCode TUI plugin context used by this plugin. */
export interface OpenCodePluginContext {
  readonly options: Readonly<Record<string, unknown>>;
  readonly location?: { readonly directory: string; readonly workspaceID?: string };
  readonly data: {
    readonly listen: (handler: (event: { readonly details: unknown }) => void) => () => void;
    readonly session: {
      get(sessionID: string): SessionInfo | undefined;
      cost(sessionID: string): number;
      sync(sessionID: string): Promise<void>;
      readonly message: {
        list(sessionID: string): ReadonlyArray<SessionMessageInfo>;
        sync(sessionID: string): Promise<void>;
      };
    };
    readonly location: {
      default(): { readonly directory: string; readonly workspaceID?: string };
      readonly model: {
        list(location?: { readonly directory: string; readonly workspaceID?: string }):
          | ReadonlyArray<ModelInfo>
          | undefined;
        sync(location?: { readonly directory: string; readonly workspaceID?: string }): Promise<void>;
      };
      readonly vcs: {
        info(location?: { readonly directory: string; readonly workspaceID?: string }): VcsInfo | undefined;
      };
    };
  };
  readonly ui: {
    readonly slot: (claim: {
      readonly replace?: "prompt.footer.status";
      readonly append?: "prompt.footer.status";
      readonly render: (input: PromptFooterInput) => unknown;
    }) => () => void;
    readonly router: {
      current(): { readonly type: "home" } | { readonly type: "session"; readonly sessionID: string } | {
        readonly type: "plugin";
        readonly id: string;
        readonly name: string;
      };
    };
  };
  readonly theme: {
    readonly text: {
      readonly base: string;
      readonly muted: string;
    };
  };
  readonly renderer: {
    readonly width: number;
  };
}
