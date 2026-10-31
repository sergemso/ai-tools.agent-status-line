/**
 * Per-item text style. Three levels, most readable first:
 *   words  "next call 3.6¢"   short  "next 3.6¢"   glyph  "⚡ 3.6¢"   ascii  "nx 3.6c" (plain ASCII, never auto-picked by width)
 * Resolution: formats["section.item"] > formats["section"] > format (unless "auto")
 * > the level the layout picked for the current width (ctx.formatLevel) > "glyph".
 */

import type { RenderContext } from "./model.js";

export type ItemFormat = "words" | "short" | "glyph" | "ascii";
/** Most readable first: the layout tries these in order and keeps the first that fits. */
export const FORMAT_LEVELS: ItemFormat[] = ["words", "short", "glyph"];

export function itemFormat(ctx: RenderContext, section: string, item: string): ItemFormat {
  const c = ctx?.config;
  const forced = c?.formats?.[`${section}.${item}`] ?? c?.formats?.[section] ?? (c?.format && c.format !== "auto" ? c.format : undefined);
  return forced ?? ctx?.formatLevel ?? "glyph";
}

/** Parse "section.item=words,section=glyph" into a formats map; ignores malformed entries. */
export function parseFormats(value: string | undefined): Record<string, ItemFormat> {
  const out: Record<string, ItemFormat> = {};
  for (const part of (value ?? "").split(",")) {
    const [k, v] = part.split("=").map((x) => x.trim());
    if (k && (v === "words" || v === "short" || v === "glyph" || v === "ascii")) out[k] = v;
  }
  return out;
}

/** Plain-ASCII form of a cost string. */
export const asciiCost = (s: string): string => s.replace(/¢/g, "c");

/**
 * Whether the environment can show non-ASCII symbols. False for a non-UTF-8 locale or a
 * bare console (TERM=linux/dumb). Says nothing about missing glyphs in a font; the wizard asks.
 */
export function unicodeOk(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): boolean {
  if (env.TERM === "linux" || env.TERM === "dumb") return false;
  if (platform === "win32") return true;
  const loc = env.LC_ALL || env.LC_CTYPE || env.LANG;
  return !loc || /utf-?8/i.test(loc) || loc === "C.UTF-8";
}
