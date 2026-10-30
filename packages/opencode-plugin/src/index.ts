/**
 * @statusline/opencode-plugin — OpenCode plugin package.
 *
 * The TUI part lives in `./tui` and renders the status line. This entrypoint
 * is the package's server part (a no-op) plus the pure, runtime-independent
 * adapter/render helpers that are useful to tests and embedders.
 */

import type { Plugin as PluginSdk } from "@opencode/plugin";

/** Server part: this plugin only contributes TUI UI, so setup is a no-op. */
const server: PluginSdk.Plugin = {
  id: "statusline.opencode",
  setup() {},
};

export default server;

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
