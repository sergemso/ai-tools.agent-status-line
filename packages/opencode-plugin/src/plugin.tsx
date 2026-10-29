/**
 * OpenCode TUI plugin — claims the `prompt.footer.status` slot and
 * renders a @statusline/core status line into it.
 *
 * Lifecycle:
 *   1. setup(context) subscribes to session/model/vcs updates and claims
 *      the prompt.footer.status slot with a `replace` placement.
 *   2. The render callback (called reactively by SolidJS on data change)
 *      resolves the current session, adapts it to CoreRenderInput, runs
 *      the core pipeline, converts ANSI → coloured spans, and emits
 *      <text> elements.
 *   3. On teardown, all subscriptions and the slot claim are released.
 *
 * The plugin runs in-process inside the OpenCode TUI. It does NOT work
 * in ACP mode (where opencode is a protocol server and the editor
 * renders its own UI).
 */

import { createMemo, createRoot, type JSX } from "solid-js";
// @opencode/plugin/tui — provided by the host at runtime (peer dep).
// We use a dynamic require shim so the import survives type-checking
// without the package installed during development.
import type { OpenCodePluginContext, PromptFooterInput } from "./types.js";
import { adaptSession, type CoreRenderInput } from "./adapter.js";
import { renderStatusLine } from "./render.js";
import { ansiToSpans, type Span } from "./ansi.js";

export interface StatusLinePluginOptions {
  /** Override the default sections (legacy comma-separated names). */
  readonly sections?: string;
}

/**
 * Create the OpenCode plugin definition.
 *
 * Usage in an OpenCode plugin entry point:
 *
 *   ```ts
 *   import { define } from "@opencode/plugin/tui";
 *   import { createStatusLinePlugin } from "@statusline/opencode-plugin";
 *   export default define(createStatusLinePlugin());
 *   ```
 */
export function createStatusLinePlugin(options: StatusLinePluginOptions = {}) {
  return {
    id: "statusline.status-line",
    setup(context: OpenCodePluginContext): () => void {
      const cleanups: Array<() => void> = [];

      // Claim the prompt.footer.status slot.
      const releaseSlot = context.ui.slot({
        replace: "prompt.footer.status",
        render: (input: PromptFooterInput): JSX.Element => {
          return renderStatusLineSlot(context, input, options.sections);
        },
      });
      cleanups.push(releaseSlot);

      // Subscribe to data changes so SolidJS memos recompute. The actual
      // reactivity is driven by the host re-invoking the slot render with
      // fresh data; subscriptions here ensure invalidation propagates.
      const unsubSession = context.data.on("session.updated", () => {
        // SolidJS reactivity handles re-render; this just keeps the
        // signal graph warm.
      });
      cleanups.push(unsubSession);

      const unsubModel = context.data.on("model.updated", () => {});
      cleanups.push(unsubModel);

      return () => {
        for (const cleanup of cleanups) {
          try {
            cleanup();
          } catch {
            // Best-effort teardown.
          }
        }
      };
    },
  };
}

/**
 * Render the status line for a given footer input.
 *
 * Exported for unit testing — the JSX output is a tree of <text> elements
 * which cannot be serialised in a unit test, so tests call
 * `renderStatusLineString` instead.
 */
function renderStatusLineSlot(
  context: OpenCodePluginContext,
  input: PromptFooterInput,
  sectionsOverride?: string,
): JSX.Element {
  const sessionID = input.sessionID;
  if (!sessionID) return <TextFallback />;

  const session = context.data.session.get(sessionID);
  if (!session) return <TextFallback />;

  const modelRef = session.model;
  const modelInfo = modelRef
    ? context.data.model.list().find(
        (m) => m.id === modelRef.id && m.providerID === modelRef.providerID,
      )
    : undefined;

  const vcs = context.data.location.vcs.info();

  const coreInput = adaptSession(session, {
    resolveModel: () => modelInfo,
    vcs,
  });

  const width = context.renderer?.width ?? 120;
  const ansi = renderStatusLine(coreInput, {
    width,
    margin: 0,
    widthConstrained: true,
    sections: sectionsOverride ?? null,
  });

  const spans = ansiToSpans(ansi);
  return <TextSpans spans={spans} />;
}

/**
 * Render coloured spans as nested <text> elements.
 *
 * Uses `fg` for foreground colour and falls back to the default text
 * colour when a span has no explicit colour.
 */
function TextSpans(props: { spans: readonly Span[] }): JSX.Element {
  return (
    <text wrapMode="none" flexShrink={0}>
      {props.spans.map((span, i) => (
        <text
          // biome-ignore lint/solid/no-array-index: stable within a single render
          key={i}
          fg={span.fg}
          bold={span.bold}
          // opentui has no explicit `dim` prop — emulate with a muted colour.
          fgFallback={span.dim ? "#808080" : undefined}
          wrapMode="none"
        >
          {span.text}
        </text>
      ))}
    </text>
  );
}

function TextFallback(): JSX.Element {
  return <text fg="#808080" wrapMode="none"></text>;
}

export { renderStatusLineSlot as _renderStatusLineSlot };
