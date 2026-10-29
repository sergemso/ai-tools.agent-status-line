// Interactive setup: `statusline config wizard` (or flags for scripted use).
// Measures what it can from your own session transcripts, then asks only about taste.

import { promises as fs } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { loadConfig, putSettings, dropSettings } from "shared/config-file.js";
import { loadPrices } from "shared/prices.js";
import { detectCols } from "shared/terminal.js";
import { adapterRegistry } from "adapters/index.js";
import type { StatusLineAdapter } from "adapters/index.js";
import { unicodeOk } from "@statusline/core";
import { formatStatusLine } from "./formatter.js";
import { DEFAULT_SECTIONS, DEFAULT_FRESH_TOKENS } from "shared/constants.js";

interface Preset { name: string; sections: string; format: string; about: string }

const PRESETS: Preset[] = [
  { name: "balanced", sections: DEFAULT_SECTIONS, format: "auto", about: "everything useful, readable words when there is room (default)" },
  { name: "minimal", sections: "model,context,cost", format: "glyph", about: "model, context, session cost; compact" },
  { name: "cost-watcher", sections: "model,context,cost,overhead,cache", format: "auto", about: "spend and restart economics, no rate-limit windows" },
  { name: "everything", sections: "model,context,tokens,cost,overhead,cache,stats,resets", format: "auto", about: "all sections, including tokens and cache hit rate" },
  { name: "cryptic", sections: DEFAULT_SECTIONS, format: "glyph", about: "balanced content, always compact glyphs" },
];
// Style previews always include the efficiency and cache items, so the styles are comparable
const PREVIEW_SECTIONS = "model,context,cost,overhead,cache";
const FORMATS = [
  { id: "auto", about: "most readable style that fits the width (default)" },
  { id: "words", about: 'always plain words: "next call 3.6¢"' },
  { id: "short", about: 'always short words: "next 3.6¢"' },
  { id: "glyph", about: 'always compact glyphs: "⚡3.6¢"' },
  { id: "ascii", about: 'plain ASCII only: "nx 3.6c"' },
];

/** Width in terminal cells of a string, measured with a cursor-position report; null if unavailable. */
async function measureCells(text: string): Promise<number | null> {
  const stdin = process.stdin;
  if (!stdin.isTTY || !process.stdout.isTTY) return null;
  return new Promise((resolve) => {
    let buf = "";
    const done = (v: number | null) => {
      stdin.removeListener("data", onData);
      clearTimeout(timer);
      try { stdin.setRawMode(false); } catch { /* ignore */ }
      stdin.pause();
      process.stdout.write("\r\x1b[K");
      resolve(v);
    };
    const onData = (d: Buffer) => {
      buf += d.toString();
      const m = buf.match(/\x1b\[(\d+);(\d+)R/);
      if (m) done(parseInt(m[2], 10) - 1);
    };
    const timer = setTimeout(() => done(null), 500);
    try { stdin.setRawMode(true); } catch { return resolve(null); }
    stdin.resume();
    stdin.on("data", onData);
    process.stdout.write(`\r\x1b[K${text}\x1b[6n`);
  });
}

const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR;
const paint = (code: string) => (t: string) => (useColor ? `\x1b[${code}m${t}\x1b[0m` : t);
const bold = paint("1"), dim = paint("2"), cyan = paint("36"), green = paint("32"), yellow = paint("33"), boldCyan = paint("1;36");
const strip = (s: string) => (useColor ? s : s.replace(/\x1b\[[0-9;]*m/g, ""));

async function preview(adapter: StatusLineAdapter, claudeConfigDir: string, width: number, opts: { format: string; sections: string; fresh: number; baseModel?: string; emojiWidth?: number }): Promise<string> {
  const unified = adapter.parse(adapter.sampleInput!());
  const line = await formatStatusLine(unified, {
    width, margin: 2, sections: opts.sections, format: opts.format, freshTokens: opts.fresh,
    baseModel: opts.baseModel, emojiWidth: opts.emojiWidth, claudeConfigDir, pricesTtl: 1e9,
  } as any);
  return strip(line);
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function runWizard(claudeConfigDir: string, argv: string[]): Promise<void> {
  const yes = argv.includes("--yes");
  const interactive = !yes && process.stdin.isTTY === true;
  if (!interactive && !yes) {
    console.log("The wizard needs a terminal. For scripts use: statusline config wizard --yes [--preset NAME] [--format auto|words|short|glyph] [--fresh TOKENS] [--agent NAME] [--no-calibrate]");
    return;
  }
  // Terminal facts that need raw input: measured before the line-based prompts start.
  const boltCells = interactive ? await measureCells("⚡") : null;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  const ask = (q: string): Promise<string> => (rl ? new Promise((res) => rl.question(q, (a) => res(a.trim()))) : Promise.resolve(""));
  const choose = async (title: string, items: string[], def: number): Promise<number> => {
    console.log(`\n${bold(title)}`);
    items.forEach((t, i) => {
      const m = t.match(/^(.*?\S)(\s{2,})(.*)$/);
      const text = m ? `${m[1]}${m[2]}${dim(m[3])}` : t;
      console.log(`  ${cyan(`${i + 1})`)} ${text}${i === def ? green("  [default]") : ""}`);
    });
    for (;;) {
      const a = await ask(`${yellow(`Choose 1-${items.length}`)} (Enter = ${def + 1}): `);
      if (a === "") return def;
      const n = parseInt(a, 10);
      if (n >= 1 && n <= items.length) return n - 1;
      console.log(yellow("  not a valid choice"));
    }
  };

  const current = await loadConfig(claudeConfigDir);
  console.log(`${boldCyan("Agent status line setup")}\n`);

  // 0. Which agent: from --agent, else the installed ones
  const known = adapterRegistry.getAgentTypes();
  let agent = arg(argv, "--agent") ?? "";
  if (!known.includes(agent as any)) {
    const installed = known.filter((a) => adapterRegistry.get(a as any)?.isInstalled?.());
    if (installed.length === 1) agent = installed[0];
    else if (installed.length > 1 && interactive) agent = installed[await choose("Which agent are you setting up?", installed, 0)];
    else agent = installed[0] ?? known[0];
  }
  const adapter = adapterRegistry.get(agent as any)!;
  if (!adapter.sampleInput) { console.log(yellow(`The wizard has no sample session for ${agent}; use \`statusline config\` directly.`)); rl?.close(); return; }
  console.log(`${dim("Agent:")} ${bold(agent)}`);

  // 1. Measured baseline
  let fresh = parseInt(current.FRESH_TOKENS ?? "", 10) || DEFAULT_FRESH_TOKENS;
  if (!argv.includes("--no-calibrate")) {
    const m = (await adapter.measureBaseline?.(claudeConfigDir)) ?? null;
    if (m) {
      console.log(`${green("Measured:")} a fresh session starts at about ${bold(m.tokens.toLocaleString())} tokens ${dim(`(median of ${m.samples} recent sessions; default ${DEFAULT_FRESH_TOKENS.toLocaleString()})`)}.`);
      if (interactive) {
        const c = await choose("Use the measured baseline for the restart estimates (⇲, ⟲)?", [`use ${m.tokens.toLocaleString()}`, `keep ${fresh.toLocaleString()}`, "enter a number"], 0);
        if (c === 0) fresh = m.tokens;
        else if (c === 2) { const n = parseInt(await ask("Tokens: "), 10); if (n > 0) fresh = n; }
      } else fresh = m.tokens;
    } else console.log(yellow(`Nothing to measure for ${agent} (no usable session history); keeping the default baseline.`));
  }
  const fArg = parseInt(arg(argv, "--fresh") ?? "", 10);
  if (fArg > 0) fresh = fArg;

  // 2. Preset
  let pi = PRESETS.findIndex((p) => p.name === arg(argv, "--preset"));
  if (pi < 0) pi = interactive ? await choose("Preset:", PRESETS.map((p) => `${p.name.padEnd(13)} ${p.about}`), 0) : 0;
  const preset = PRESETS[pi];

  // 3a. Symbols: can this terminal and font show them?
  let symbolsOk = unicodeOk();
  let emojiWidth = boltCells === 1 ? 1 : 2;
  if (interactive) {
    console.log(`\n${bold("Symbols")}: ${"Σ ⚡ ⇲ ⟲ ⏱ ▕▂▏ ¢"}`);
    if (boltCells !== null) console.log(dim(`  (this terminal draws ⚡ ${boltCells} cell${boltCells === 1 ? "" : "s"} wide${boltCells === 1 ? "; line widths will be adjusted" : ""})`));
    symbolsOk = (await choose("Do all of those display correctly (no empty boxes or question marks)?", ["yes, all fine", "no, some are broken: use plain ASCII"], symbolsOk ? 0 : 1)) === 0;
  }

  // 3b. Format, with previews
  let format = arg(argv, "--format") ?? (symbolsOk ? "" : "ascii");
  if (!FORMATS.some((f) => f.id === format)) {
    if (interactive) {
      console.log(`\n${bold("Text style")}, as it looks on a sample session ${dim("(180k tokens of context, warm cache)")}:`);
      for (const f of FORMATS) {
        console.log(`\n  ${boldCyan(f.id)}${dim(`: ${f.about}`)}`);
        for (const w of f.id === "auto" ? [150, 110, 80] : [150]) {
          console.log(`    ${dim(`${String(w).padStart(3)} cols`)}  ${await preview(adapter, claudeConfigDir, w, { format: f.id, sections: PREVIEW_SECTIONS, fresh, emojiWidth })}`);
        }
      }
      const def = Math.max(0, FORMATS.findIndex((f) => f.id === preset.format));
      format = FORMATS[await choose("Text style:", FORMATS.map((f) => `${f.id.padEnd(6)} ${f.about}`), def)].id;
    } else format = preset.format;
  }

  // 4. Base model
  let baseModel = current.BASE_MODEL;
  if (interactive) {
    const names = Object.keys((await loadPrices(claudeConfigDir, 1e9)).models);
    if (names.length) {
      const def = Math.max(0, names.indexOf(baseModel ?? "Claude Sonnet 5.5"));
      console.log(dim("\nThe multiplier (e.g. x2) compares the active model's price with a base model's."));
      baseModel = names[await choose("Base model:", names, def)];
    }
  }

  // 5. Save
  console.log(`\n${bold("Summary:")} preset ${boldCyan(preset.name)}, style ${boldCyan(format)}, baseline ${bold(fresh.toLocaleString())} tokens${baseModel ? `, base model ${bold(baseModel)}` : ""}`);
  console.log(`${bold(`Preview (${await detectCols() || 120} cols):`)} ${await preview(adapter, claudeConfigDir, (await detectCols()) || 120, { format, sections: preset.sections, fresh, baseModel, emojiWidth })}`);
  if (interactive) {
    const a = (await ask(`\n${yellow("Save these settings?")} [Y/n] `)).toLowerCase();
    if (a === "n" || a === "no") { console.log(yellow("Nothing saved.")); rl?.close(); return; }
  }
  const entries: Array<[any, string]> = [["SECTIONS", preset.sections], ["FRESH_TOKENS", String(fresh)]];
  if (baseModel) entries.push(["BASE_MODEL", baseModel]);
  if (format !== "auto") entries.push(["FORMAT", format]);
  if (emojiWidth === 1) entries.push(["EMOJI_WIDTH", "1"]);
  await putSettings(claudeConfigDir, entries);
  if (emojiWidth !== 1) await dropSettings(claudeConfigDir, ["EMOJI_WIDTH"]);
  if (format === "auto") await dropSettings(claudeConfigDir, ["FORMAT"]);
  console.log(`${green("Saved.")} ${dim("It takes effect on the next refresh. Fine-tune with `statusline config ...`; per-item styles: `statusline config format`.")}`);
  rl?.close();
}
