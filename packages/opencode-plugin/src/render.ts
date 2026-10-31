/**
 * Render a CoreRenderInput into an ANSI status-line string using
 * @statusline/core's section-priority pipeline.
 *
 * This is the bridge between the OpenCode adapter (which produces a
 * CoreRenderInput from session data) and the @statusline/core rendering
 * pipeline (getSections → buildLayout → cliRenderer.render).
 *
 * Exposed separately from plugin.tsx so it can be unit-tested without
 * an OpenCode runtime — feed in a CoreRenderInput, get back an ANSI
 * string identical to what the CLI formatter would produce for the
 * same data.
 */

import {
  buildLayout,
  getSections,
  cliRenderer,
  type RenderContext,
  type UserConfig,
  PriorityLevel as P,
} from "@statusline/core";
import type { CoreRenderInput } from "./adapter.js";

export interface RenderStatusLineOptions {
  /** Available width in characters. Defaults to 120. */
  readonly width?: number;
  /** Right margin in characters. Defaults to 0 (opencode manages its own padding). */
  readonly margin?: number;
  /**
   * Whether the width is a hard constraint (enables priority-based
   * shrinking). When false, all enabled sections are always shown.
   * Defaults to true.
   */
  readonly widthConstrained?: boolean;
  /**
   * Comma-separated legacy section names to enable/disable. Pass null to
   * use core's own defaults (every section with data, including worktree).
   * Leave undefined for the OpenCode default set.
   */
  readonly sections?: string | null;
}

/** Default sections for OpenCode (no cache/overhead — data unavailable). */
export const DEFAULT_OPENCODE_SECTIONS = "model,context,cost,tokens,resets";

/**
 * Defaults when sharing the footer row with OpenCode's own status, which
 * already shows context usage and cost on the right.
 */
export const FOOTER_OPENCODE_SECTIONS = "model,tokens,resets";

/**
 * Render a CoreRenderInput into an ANSI status-line string.
 */
export function renderStatusLine(
  input: CoreRenderInput,
  options: RenderStatusLineOptions = {},
): string {
  const {
    width = 120,
    margin = 0,
    widthConstrained = true,
    sections = DEFAULT_OPENCODE_SECTIONS,
  } = options;

  const userConfig = buildUserConfig(sections);
  const ctx: RenderContext = {
    input: input as unknown as Record<string, unknown>,
    width: Math.max(0, width - margin),
    target: "cli",
    config: userConfig,
    widthConstrained,
  };

  const sectionsList = getSections(userConfig, ctx);
  const layout = buildLayout(sectionsList, ctx);
  return cliRenderer.render(layout, ctx);
}

/**
 * Build a UserConfig from a legacy comma-separated sections string.
 *
 * Mirrors the logic in src/formatter.ts:buildUserConfig but simplified
 * for the OpenCode subset (no rate-limits filter, no stats alias).
 */
function buildUserConfig(sections: string | null): UserConfig {
  const config: UserConfig = {
    sections: {},
    items: {},
    priorityThreshold: P.NONE,
  };

  if (sections === null) return config;

  const enabled = new Set(sections.split(",").map((s) => s.trim()));

  const map: Record<string, string> = {
    model: "model",
    context: "context",
    tokens: "usage",
    cost: "cost",
    overhead: "overhead",
    cache: "cache",
    stats: "cache",
    resets: "rate-limits",
    vim: "vim",
    worktree: "worktree",
    "cursor-extensions": "cursor-extensions",
  };

  for (const [legacy, id] of Object.entries(map)) {
    const isEnabled = enabled.has(legacy);
    const existing = config.sections![id];
    if (existing === undefined) {
      config.sections![id] = { enabled: isEnabled };
    } else if (isEnabled) {
      config.sections![id] = { ...existing, enabled: true };
    }
  }

  return config;
}
