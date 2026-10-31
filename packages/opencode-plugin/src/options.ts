/**
 * Plugin option handling, kept free of JSX and of OpenCode runtime imports so
 * it can be unit-tested: which slot to claim, which sections to show, and how
 * much room to leave for the host's own footer items.
 */

import { DEFAULT_OPENCODE_SECTIONS, FOOTER_OPENCODE_SECTIONS } from "./render.js";

/** Options accepted through `plugins: [{ package, options }]` in OpenCode. */
export interface StatusLineOptions {
  /**
   * Legacy comma-separated section names (model,context,cost,tokens,...).
   * Defaults to model,tokens,resets in the footer (OpenCode already shows
   * context and cost there) and to the full OpenCode set in composer-top.
   */
  readonly sections?: string;
  /**
   * Where to render:
   *  - "replace" (default): take over the footer status slot.
   *  - "append": add to the footer status slot.
   *  - "composer-top": own full-width row above the prompt, no sharing with
   *    the footer's right-hand items.
   */
  readonly placement?: Placement;
}

export type Placement = "replace" | "append" | "composer-top";

/** Columns left free before the host's right-hand footer items. */
export const FOOTER_GUTTER = 2;

export interface ResolvedOptions {
  readonly placement: Placement;
  /** True when the line shares its row with OpenCode's own footer items. */
  readonly shared: boolean;
  readonly sections: string;
  /** Columns to keep free at the right edge of the slot. */
  readonly margin: number;
}

const PLACEMENTS: readonly Placement[] = ["replace", "append", "composer-top"];

/** Fill in defaults. An unrecognised placement falls back to "replace". */
export function resolveOptions(raw: unknown): ResolvedOptions {
  const options = (raw && typeof raw === "object" ? raw : {}) as StatusLineOptions;
  const placement = PLACEMENTS.includes(options.placement as Placement)
    ? (options.placement as Placement)
    : "replace";
  const shared = placement !== "composer-top";
  return {
    placement,
    shared,
    sections:
      typeof options.sections === "string" && options.sections.length > 0
        ? options.sections
        : shared
          ? FOOTER_OPENCODE_SECTIONS
          : DEFAULT_OPENCODE_SECTIONS,
    margin: shared ? FOOTER_GUTTER : 0,
  };
}

/** The slot placement key and path for `context.ui.slot(...)`. */
export type SlotTarget =
  | { readonly replace: "prompt.footer.status" }
  | { readonly append: "prompt.footer.status" }
  | { readonly append: "session.composer.top" };

export function slotTarget(placement: Placement): SlotTarget {
  switch (placement) {
    case "composer-top":
      return { append: "session.composer.top" };
    case "append":
      return { append: "prompt.footer.status" };
    default:
      return { replace: "prompt.footer.status" };
  }
}
