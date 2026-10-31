#!/usr/bin/env node
/**
 * Generate docs/images/*.svg from the real status line output.
 *
 * Nothing here is hand-drawn: each row is produced by running the built
 * binary (bin/statusline) or the OpenCode renderer on a payload, then turning
 * the ANSI colours into SVG text. Payload times are relative to "now" so
 * countdowns and cache timers look live and the images are reproducible.
 *
 * Usage (after `npm run build:core && npm run build && npm run build:opencode`):
 *   node scripts/render-screenshots.mjs
 *
 * These are renderings of the line itself, not screenshots of the agent UIs.
 */

import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "images");
const { visibleWidth } = await import(pathToFileURL(join(ROOT, "packages/core/dist/index.js")).href);

// --- running the real line --------------------------------------------------

const cfg = mkdtempSync(join(tmpdir(), "sl-shots-"));
mkdirSync(join(cfg, "statusline"));
copyFileSync(join(ROOT, "test/fixtures/model-prices.json"), join(cfg, "model-prices.json"));
process.on("exit", () => rmSync(cfg, { recursive: true, force: true }));

function run(payload, width) {
  const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg, STATUSLINE_PRICES_TTL: "31536000", STATUSLINE_WIDTH: String(width) };
  for (const k of Object.keys(env)) if (k.startsWith("STATUSLINE_") && !["STATUSLINE_PRICES_TTL", "STATUSLINE_WIDTH"].includes(k)) delete env[k];
  const r = spawnSync("node", [join(ROOT, "bin/statusline"), "statusline"], { input: JSON.stringify(payload), encoding: "utf-8", env });
  if (r.status !== 0) throw new Error(`statusline failed: ${r.stderr}`);
  return r.stdout.replace(/\n$/, "");
}

const now = Math.floor(Date.now() / 1000);
const MIN = 60, HOUR = 3600, DAY = 86400;

/** A Claude Code status payload. */
function claude({ model = "Claude Sonnet 5.5", id = "claude-sonnet-5-5", effort, cost, ctxPct, ctxSize = 200000,
                  cacheMin, hit = 0.93, limits = {} }) {
  const used = Math.round((ctxSize * ctxPct) / 100);
  const p = {
    hook_event_name: "Status", session_id: "docs",
    model: { id, display_name: model },
    cost: { total_cost_usd: cost },
    context_window: {
      context_window_size: ctxSize, used_percentage: ctxPct, remaining_percentage: 100 - ctxPct,
      total_input_tokens: used, total_output_tokens: 0,
      current_usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: used - 2000, cache_creation_input_tokens: 0 },
    },
    prompt_cache: cacheMin == null
      ? { ttl: 300, warm: false, expires_at: now - 60, hit_ratio: 0.2, recache_tokens_if_cold: used }
      : { ttl: 3600, warm: true, expires_at: now + cacheMin * MIN + 30, hit_ratio: hit, recache_tokens_if_cold: used },
  };
  if (effort) p.effort = { level: effort };
  const rl = {};
  if (limits.five) rl.five_hour = { used_percentage: limits.five[0], resets_at: now + limits.five[1] };
  if (limits.seven) rl.seven_day = { used_percentage: limits.seven[0], resets_at: now + limits.seven[1] };
  if (Object.keys(rl).length) p.rate_limits = rl;
  return p;
}

/** A Cursor status payload. */
function cursor({ model = "Claude Sonnet 5.5", ctxPct, tokens, maxMode = false, autorun = false, width }) {
  return {
    session_id: "docs", render_width_chars: width, cwd: "/work/app", autorun,
    model: { id: "claude-sonnet-5-5", display_name: model, param_summary: "", max_mode: maxMode },
    workspace: { current_dir: "/work/app", project_dir: "/work/app", added_dirs: [] },
    context_window: { total_input_tokens: tokens, total_output_tokens: 0, context_window_size: 200000, used_percentage: ctxPct, remaining_percentage: 100 - ctxPct,
                      current_usage: { input_tokens: tokens, output_tokens: 0 } },
  };
}

// --- ANSI -> SVG ------------------------------------------------------------

const COLORS = { 30: "#6e7681", 31: "#f85149", 32: "#3fb950", 33: "#d29922", 34: "#58a6ff", 35: "#bc8cff", 36: "#39c5cf", 37: "#c9d1d9",
                 90: "#8b949e", 91: "#ff7b72", 92: "#56d364", 93: "#e3b341", 94: "#79c0ff", 95: "#d2a8ff", 96: "#56d4dd", 97: "#f0f6fc" };
const DEFAULT_FG = "#c9d1d9";
const CW = 8.4;       // monospace advance at 14px
const LINE_H = 20;

function parseAnsi(s) {
  const segs = [];
  let fg = null, dim = false, bold = false, buf = "";
  const flush = () => { if (buf) { segs.push({ text: buf, fg, dim, bold }); buf = ""; } };
  for (let i = 0; i < s.length; ) {
    const m = /^\x1b\[([0-9;]*)m/.exec(s.slice(i));
    if (m) {
      flush();
      for (const c of (m[1] || "0").split(";").map(Number)) {
        if (c === 0) { fg = null; dim = false; bold = false; }
        else if (c === 1) bold = true;
        else if (c === 2) dim = true;
        else if (c === 22) { dim = false; bold = false; }
        else if (c === 39) fg = null;
        else if (COLORS[c]) fg = COLORS[c];
      }
      i += m[0].length;
    } else { buf += s[i]; i++; }
  }
  flush();
  return segs;
}

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** SVG <text> elements for one ANSI line starting at (x, y); returns [svg, columns]. */
function lineSvg(ansi, x, y) {
  let col = 0, out = "";
  for (const seg of parseAnsi(ansi)) {
    const color = seg.fg ?? DEFAULT_FG;
    const attrs = `fill="${color}"${seg.dim ? ' fill-opacity="0.55"' : ""}${seg.bold ? ' font-weight="700"' : ""}`;
    out += `<text x="${(x + col * CW).toFixed(1)}" y="${y}" ${attrs} xml:space="preserve">${esc(seg.text)}</text>\n`;
    col += visibleWidth(seg.text);
  }
  return [out, col];
}

const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono','Noto Sans Symbols 2','Segoe UI Symbol','Apple Symbols',monospace";
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * rows: [{ caption, ansi, suffix? }] — suffix is drawn after the line in a
 * muted style (used to hint at the host's own footer text).
 */
function image({ file, title, desc, heading, rows, cols }) {
  const PAD = 20, TOP = 48;
  const width = Math.ceil(PAD * 2 + cols * CW);
  let y = TOP + 6;
  let body = "";
  for (const row of rows) {
    body += `<text x="${PAD}" y="${y}" font-family="${SANS}" font-size="12" fill="#8b949e">${esc(row.caption)}</text>\n`;
    y += LINE_H;
    const [svg, used] = lineSvg(row.ansi, PAD, y);
    body += svg;
    if (row.suffix) {
      body += `<text x="${(PAD + used * CW).toFixed(1)}" y="${y}" fill="#6e7681" xml:space="preserve">${esc(row.suffix)}</text>\n`;
    }
    y += LINE_H + 8;
  }
  const height = y + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d" font-size="14">
<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>
<!-- Generated by scripts/render-screenshots.mjs from real output; regenerate rather than hand-edit. -->
<rect width="${width}" height="${height}" rx="10" fill="#0d1117" stroke="#30363d"/>
<rect width="${width}" height="34" rx="10" fill="#161b22"/><rect y="24" width="${width}" height="10" fill="#161b22"/>
<circle cx="22" cy="17" r="6" fill="#ff5f56"/><circle cx="42" cy="17" r="6" fill="#ffbd2e"/><circle cx="62" cy="17" r="6" fill="#27c93f"/>
<text x="${width / 2}" y="22" text-anchor="middle" font-family="${SANS}" font-size="13" fill="#6e7681">${esc(heading)}</text>
<g font-family="${MONO}">
${body}</g>
</svg>
`;
  writeFileSync(join(OUT, file), svg);
  console.log(`wrote docs/images/${file}`);
}

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const cols = (rows) => Math.max(...rows.map((r) => visibleWidth(strip(r.ansi)) + (r.suffix ? r.suffix.length : 0)));

// --- scenario: one session, shrinking terminal ------------------------------

const mid = claude({ cost: 5.6, ctxPct: 42, cacheMin: 25, effort: "high",
                     limits: { five: [12, 4 * HOUR + 59 * MIN + 30], seven: [55, 6 * DAY + 23 * HOUR + 30 * MIN] } });
{
  const rows = [130, 100, 70, 45].map((w) => ({ caption: `${w} columns`, ansi: run(mid, w) }));
  image({ file: "claude-code-widths.svg", heading: "Claude Code — the same session at four terminal widths",
          title: "Status line at four widths", desc: "The same Claude Code session rendered at 130, 100, 70 and 45 columns: words, short form, glyphs, then items dropped.",
          rows, cols: cols(rows) });
}

// --- scenario: indicator states at a fixed width ----------------------------

{
  const W = 130;
  const states = [
    ["Fresh session: small context, cache warm", claude({ cost: 0.31, ctxPct: 4, cacheMin: 55, effort: "med" })],
    ["Mid session: next-call cost and restart thresholds appear", mid],
    ["Cache gone cold: 'cache cold', the next call re-pays the whole context", claude({ cost: 5.6, ctxPct: 42, effort: "high" })],
    ["Context nearly full: bar and percentage turn red", claude({ cost: 25, ctxPct: 86, cacheMin: 8, effort: "high" })],
    ["Rate limit close: 5h window at 91%", claude({ cost: 9.2, ctxPct: 30, cacheMin: 40, limits: { five: [91, 38 * MIN], seven: [64, 3 * DAY] } })],
    ["Pricier model: cost multiplier (x…) after the name", claude({ model: "Claude Opus 5.5", id: "claude-opus-5-5", cost: 3.4, ctxPct: 18, cacheMin: 30, effort: "high" })],
  ];
  const rows = states.map(([caption, p]) => ({ caption, ansi: run(p, W) }));
  image({ file: "claude-code-states.svg", heading: "Claude Code — indicator states",
          title: "Status line indicator states", desc: "Six renderings of the Claude Code status line: fresh session, mid session, cold cache, full context, rate limit close, and a pricier model.",
          rows, cols: cols(rows) });
}

// --- scenario: Cursor -------------------------------------------------------

{
  const rows = [
    { caption: "Cursor, 140 columns", ansi: run(cursor({ ctxPct: 38, tokens: 76000, width: 140 }), 140) },
    { caption: "Context past 50%: the bar turns yellow", ansi: run(cursor({ ctxPct: 62, tokens: 124000, width: 140 }), 140) },
    { caption: "Context past 80%: red", ansi: run(cursor({ ctxPct: 88, tokens: 176000, width: 70 }), 70) },
  ];
  image({ file: "cursor.svg", heading: "Cursor — what the status line shows",
          title: "Cursor status line", desc: "The status line for Cursor at 38%, 62% and 88% context use.",
          rows, cols: cols(rows) });
}

// --- scenario: OpenCode -----------------------------------------------------

{
  const plugin = join(ROOT, "packages/opencode-plugin/dist");
  const { adaptSession } = await import(pathToFileURL(join(plugin, "adapter.js")).href);
  const { renderStatusLine } = await import(pathToFileURL(join(plugin, "render.js")).href);
  const { resolveOptions } = await import(pathToFileURL(join(plugin, "options.js")).href);
  const model = { id: "glm-5.2", providerID: "zai", name: "GLM-5.2", limit: { context: 1_000_000, output: 32_000 }, cost: { input: 1, output: 3 } };
  const session = { id: "s", model: { id: "glm-5.2", providerID: "zai" }, cost: 0.94,
                    tokens: { input: 62_000, output: 13_200, reasoning: 0, cache: { read: 0, write: 0 } } };
  const input = adaptSession(session, { resolveModel: () => model, rateLimits: [{ window: "7d", limit: 10000, remaining: 8600, resetsAt: now + 6 * DAY + 10 * HOUR + 30 }] });
  const draw = (placement, width) => {
    const o = resolveOptions({ placement });
    return renderStatusLine(input, { width, margin: o.margin, widthConstrained: true, sections: o.sections });
  };
  const hostRight = "  62.6K (6%) · $0.94   ctrl+p commands";
  const rows = [
    { caption: "Default (footer): shares the row with OpenCode's own items — context and cost are left to OpenCode", ansi: draw("replace", 60), suffix: hostRight },
    { caption: "Same, narrower terminal", ansi: draw("replace", 36), suffix: "  62.6K · $0.94  ctrl+p" },
    { caption: 'placement: "composer-top": its own full-width row above the prompt, all sections', ansi: draw("composer-top", 100) },
  ];
  image({ file: "opencode.svg", heading: "OpenCode — footer vs. composer-top placement",
          title: "OpenCode placements", desc: "The OpenCode status line in the default footer placement beside OpenCode's own items, and on its own row with composer-top. OpenCode's own text is illustrative.",
          rows, cols: cols(rows) });
}
