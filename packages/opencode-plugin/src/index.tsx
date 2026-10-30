/**
 * @statusline/opencode-plugin — OpenCode plugin package.
 *
 * The default export is the TUI plugin that OpenCode loads when the package
 * is listed in `plugins`. The plugin is defined inline here via
 * `Plugin.define({ id, setup })` so that OpenCode's static plugin validator
 * can see the `export default Plugin.define({ ... })` pattern directly.
 *
 * The pure-logic modules below are useful to tests and embedders.
 */

import { For, Show, createMemo, createSignal } from "solid-js";
import type { RGBA } from "@opentui/core";
import { Plugin } from "@opencode/plugin/tui";
import { adaptSession } from "./adapter.js";
import { renderStatusLine } from "./render.js";
import { ansiToSpans, type Span } from "./ansi.js";
import type { ModelInfo, ModelRef, TokenUsageInfo } from "./types.js";

/** Options accepted through `plugins: [{ package, options }]` in OpenCode. */
interface StatusLineOptions {
  /** Legacy comma-separated section names (model,context,cost,tokens,...). */
  readonly sections?: string;
  /** Replace the host status slot (default) or append to it. */
  readonly placement?: "replace" | "append";
}

type LocationRef = { readonly directory: string; readonly workspaceID?: string };

export default Plugin.define({
  id: "statusline.opencode",
  setup(context) {
    const options = context.options as StatusLineOptions;

    // Repaint when any server event lands. Events can be frequent while a
    // model streams, so coalesce bursts into one repaint per ~100ms.
    const [version, setVersion] = createSignal(0, { equals: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scheduled = false;
    const bump = () => setVersion((value) => value + 1);
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      timer = setTimeout(() => {
        scheduled = false;
        timer = undefined;
        bump();
      }, 100);
    };
    const stopEvents = context.data.listen(schedule);

    const locationOf = (sessionID?: string): LocationRef => {
      if (sessionID) {
        const session = context.data.session.get(sessionID);
        if (session?.location?.directory) return session.location;
      }
      return context.location ?? context.data.location.default();
    };

    // Model catalogues are location-scoped and may not be hydrated yet.
    const syncedModels = new Set<string>();
    const ensureModels = (location: LocationRef) => {
      const key = `${location.directory}\u0000${location.workspaceID ?? ""}`;
      if (syncedModels.has(key)) return;
      syncedModels.add(key);
      void context.data.location.model.sync(location).catch(() => {});
    };

    // The transcript is paged; ask for the current session once so the
    // context window can be read from the latest assistant message.
    const syncedSessions = new Set<string>();
    const ensureSession = (sessionID: string) => {
      if (syncedSessions.has(sessionID)) return;
      syncedSessions.add(sessionID);
      void Promise.allSettled([
        context.data.session.sync(sessionID),
        context.data.session.message.sync(sessionID),
      ]).finally(schedule);
    };

    ensureModels(locationOf());

    const StatusLine = (props: { sessionID?: string }) => {
      // The width the host actually dealt this slot. It is known after the
      // first layout pass; until then fall back to the terminal width.
      const [fitted, setFitted] = createSignal<number | undefined>(undefined);

      const view = createMemo<Span[] | undefined>(() => {
        // Reading the signal makes the memo repaint on server events.
        version();

        const sessionID = props.sessionID ?? currentSessionID(context);
        if (!sessionID) return undefined;

        ensureSession(sessionID);
        const session = context.data.session.get(sessionID);
        if (!session) return undefined;

        const location = session.location?.directory ? session.location : locationOf(sessionID);
        ensureModels(location);

        const models = context.data.location.model.list(location) ?? [];
        const window = latestWindow(context, sessionID);
        const modelRef = window?.model ?? session.model;
        const modelInfo = modelRef ? findModel(models, modelRef) : undefined;
        const vcs = context.data.location.vcs.info(location);

        const input = adaptSession(session, {
          resolveModel: () => modelInfo,
          modelRef,
          windowTokens: window?.tokens,
          vcs,
        });

        const width = Math.max(20, fitted() ?? context.renderer.width ?? 120);
        const ansi = renderStatusLine(input, {
          width,
          margin: 0,
          widthConstrained: true,
          sections: options.sections ?? null,
        });
        return ansiToSpans(ansi);
      });

      return (
        <Show when={view()}>
          {(spans: () => Span[]) => (
            <box
              flexDirection="row"
              minWidth={0}
              onSizeChange={function (this: { width: number }) {
                const width = this.width;
                // Deferred: this runs inside layout; writing the signal
                // directly would re-enter the render that caused it.
                queueMicrotask(() => setFitted(width));
              }}
            >
              <text wrapMode="none">
                <For each={spans()}>
                  {(span) => (
                    <span style={{ fg: spanColor(span, context.theme) }}>
                      {span.text}
                    </span>
                  )}
                </For>
              </text>
            </box>
          )}
        </Show>
      );
    };

    const render = (input: { sessionID?: string }) => (
      <StatusLine sessionID={input.sessionID} />
    );

    const release =
      options.placement === "append"
        ? context.ui.slot({ append: "prompt.footer.status", render })
        : context.ui.slot({ replace: "prompt.footer.status", render });

    return () => {
      release();
      stopEvents();
      if (timer) clearTimeout(timer);
    };
  },
});

/** The session shown by the current route, when the slot input has none. */
function currentSessionID(context: {
  ui: { router: { current(): { type: string; sessionID?: string } } };
}): string | undefined {
  const route = context.ui.router.current();
  return route.type === "session" ? route.sessionID : undefined;
}

/** Find a model by the reference stored on a session or message. */
function findModel(
  models: ReadonlyArray<ModelInfo>,
  ref: ModelRef,
): ModelInfo | undefined {
  return models.find(
    (model) =>
      model.providerID === ref.providerID &&
      (model.id === ref.id || model.modelID === ref.id),
  );
}

/**
 * The newest assistant message that reported usage. The session record's
 * token totals are cumulative across turns, so the context window is read
 * from the last request instead.
 */
function latestWindow(
  context: {
    data: {
      session: {
        message: {
          list(sessionID: string): ReadonlyArray<{
            readonly type: string;
            readonly model?: ModelRef;
            readonly tokens?: TokenUsageInfo;
          }>;
        };
      };
    };
  },
  sessionID: string,
): { readonly model?: ModelRef; readonly tokens: TokenUsageInfo } | undefined {
  let found: { readonly model?: ModelRef; readonly tokens: TokenUsageInfo } | undefined;

  for (const message of context.data.session.message.list(sessionID)) {
    if (message.type !== "assistant" || !message.tokens) continue;
    if (contextUsed(message.tokens) > 0) {
      found = { model: message.model, tokens: message.tokens };
    }
  }
  return found;
}

function contextUsed(tokens: TokenUsageInfo): number {
  return (
    tokens.input +
    tokens.output +
    tokens.reasoning +
    tokens.cache.read +
    tokens.cache.write
  );
}

/** Resolve a span's colour, preferring the host theme for muted text. */
function spanColor(
  span: Span,
  theme: { readonly text: { readonly base: string | RGBA; readonly muted: string | RGBA } },
): string | RGBA {
  if (span.dim) return theme.text.muted;
  return span.fg ?? theme.text.base;
}

export { adaptSession } from "./adapter.js";
export type { CoreRenderInput, AdaptOptions } from "./adapter.js";

export { renderStatusLine } from "./render.js";
export type { RenderStatusLineOptions } from "./render.js";

export { ansiToSpans, spansToPlainText } from "./ansi.js";
export type { Span } from "./ansi.js";

export type {
  OpenCodePluginContext,
  PromptFooterInput,
  SessionInfo,
  SessionMessageInfo,
  ModelInfo,
  ModelRef,
  TokenUsageInfo,
  VcsInfo,
} from "./types.js";
