/**
 * @statusline/opencode-plugin — server part.
 *
 * OpenCode loads a package's `.` export in the server process and its
 * `./tui` export in the TUI process. This package only renders UI, so the
 * server part is intentionally empty: it exists so OpenCode can register
 * the package by name without trying to run TUI code in the server (where
 * `context.data` is a server context and has no `listen`, `ui`, or
 * `renderer`).
 *
 * The actual status line lives in `./tui` (see `tui.tsx`).
 */

import { Plugin } from "@opencode/plugin";

export default Plugin.define({
  id: "statusline.opencode",
  setup() {
    // No server-side behaviour: the status line is rendered by the TUI part.
  },
});
