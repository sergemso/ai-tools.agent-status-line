/**
 * @statusline/opencode-plugin — OpenCode plugin package.
 *
 * The default export is the TUI plugin (defined in ./tui) that OpenCode loads
 * when the package is listed in `plugins`. The pure-logic modules below are
 * useful to tests and embedders.
 */

import tuiPlugin from "./tui.js";
export default tuiPlugin;

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
