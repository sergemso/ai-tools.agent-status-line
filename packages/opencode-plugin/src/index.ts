/**
 * @statusline/opencode-plugin — OpenCode TUI plugin that renders a
 * @statusline/core status line into the prompt.footer.status slot.
 *
 * See README.md for installation and usage.
 */

// The TUI plugin entry (plugin.tsx) is excluded from the tsc build because
// it uses JSX types provided by the OpenCode host (@opentui/solid) at
// runtime. Import it directly from "./plugin.js" when running inside
// OpenCode:
//
//   import { createStatusLinePlugin } from "@statusline/opencode-plugin/plugin";
//
// The pure-logic modules below are fully typed and unit-tested.

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
  ModelInfo,
  ModelRef,
  TokenUsageInfo,
  VcsInfo,
} from "./types.js";
