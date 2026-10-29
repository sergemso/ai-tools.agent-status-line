// Config management CLI

import { join } from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import {
  DEFAULT_BASE_MODEL,
  DEFAULT_SECTIONS,
  DEFAULT_RESETS,
  DEFAULT_CONTEXT_WARN,
  DEFAULT_CONTEXT_CRIT,
  DEFAULT_CACHE_WARN,
  DEFAULT_CACHE_CRIT,
  DEFAULT_RESET_WARN,
  DEFAULT_RESET_CRIT,
  DEFAULT_WIDTH,
  DEFAULT_MARGIN,
  DEFAULT_FRESH_TOKENS,
  DEFAULT_SUMMARY_TOKENS,
  DEFAULT_OVERHEAD_WARN,
  DEFAULT_OVERHEAD_CRIT,
  ALL_SECTIONS,
} from "shared/constants.js";
import { loadConfig, putSetting, putSettings, dropSettings, resetAllSettings, getConfigPath } from "shared/config-file.js";
import { loadPrices, getPricesPath } from "shared/prices.js";
import { getClaudeConfigDir } from "utils/config-utils.js";
import { ConfigSettings } from "shared/types.js";

const __filename = fileURLToPath(import.meta.url);

interface CliArgs {
  command: string;
  args: string[];
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.length === 0) return { command: "help", args: [] };
  return { command: argv[0], args: argv.slice(1) };
}

function usage(): void {
  console.log(`Usage: config <command>
  show                          current settings (value, and where it comes from)
  model [NAME|list]             base model for the price multiplier (x1.0); no NAME = show
  sections [list]               enabled/hidden sections and the valid names
  sections show|hide NAME...    enable/disable sections
  sections only NAME...         enable just these
  sections all                  enable all
      NAME: model context tokens cost overhead cache stats resets   (overhead = extra cost of continuing vs a fresh session; stats = always show the cache hit rate (default: only when below 80%))
  resets LIST|all|none          which reset windows to show, e.g. 5h,7d,spend
  thresholds context|resets WARN CRIT   yellow/red at WARN/CRIT percent used (0-100)
  thresholds cache WARN CRIT            yellow/red when WARN/CRIT minutes are left
  thresholds overhead WARN CRIT         yellow/red at WARN/CRIT extra cents per call vs a fresh session
  overhead [FRESH [SUMMARY]]    token sizes for the overhead metric: a fresh session (25000), a compaction summary (8000)
  width [N|auto]                terminal columns to fit the line into (auto = detect from the tty)
  margin N                      columns kept free at the right edge (default 2)
  dump [PATH|off]               write the raw status-line JSON + detected width/level to PATH on each run
  reset [KEY...]                drop saved settings (all if none given)
      KEY: BASE_MODEL SECTIONS RESETS CONTEXT_WARN CONTEXT_CRIT CACHE_WARN CACHE_CRIT RESET_WARN RESET_CRIT WIDTH MARGIN DUMP FRESH_TOKENS SUMMARY_TOKENS OVERHEAD_WARN OVERHEAD_CRIT`);
}

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function isInt(s: string): boolean {
  return /^\d+$/.test(s);
}

function currentSections(config: ConfigSettings): string {
  const v = config.SECTIONS;
  return v ? v : ALL_SECTIONS.join(",");
}

function validSection(s: string): boolean {
  return ALL_SECTIONS.includes(s as any);
}

async function cmdShow(claudeConfigDir: string): Promise<void> {
  const config = await loadConfig(claudeConfigDir);
  const pricesPath = getPricesPath(claudeConfigDir);

  const defaults: Array<[string, string]> = [
    ["BASE_MODEL", DEFAULT_BASE_MODEL],
    ["SECTIONS", DEFAULT_SECTIONS],
    ["RESETS", DEFAULT_RESETS],
    ["CONTEXT_WARN", String(DEFAULT_CONTEXT_WARN)],
    ["CONTEXT_CRIT", String(DEFAULT_CONTEXT_CRIT)],
    ["CACHE_WARN", String(DEFAULT_CACHE_WARN)],
    ["CACHE_CRIT", String(DEFAULT_CACHE_CRIT)],
    ["RESET_WARN", String(DEFAULT_RESET_WARN)],
    ["RESET_CRIT", String(DEFAULT_RESET_CRIT)],
    ["WIDTH", `${DEFAULT_WIDTH}(auto)`],
    ["MARGIN", String(DEFAULT_MARGIN)],
    ["FRESH_TOKENS", String(DEFAULT_FRESH_TOKENS)],
    ["SUMMARY_TOKENS", String(DEFAULT_SUMMARY_TOKENS)],
    ["OVERHEAD_WARN", String(DEFAULT_OVERHEAD_WARN)],
    ["OVERHEAD_CRIT", String(DEFAULT_OVERHEAD_CRIT)],
  ];

  console.log("setting         value                                    source");
  for (const [key, def] of defaults) {
    const envKey = `STATUSLINE_${key}`;
    let value: string;
    let source: string;

    if (process.env[envKey] !== undefined) {
      value = process.env[envKey]!;
      source = `env ${envKey}`;
    } else if (key in config) {
      value = config[key] ?? def;
      source = "saved";
    } else {
      value = def;
      source = "default";
    }

    console.log(`${key.padEnd(14)} ${value.padEnd(38)} ${source}`);
  }
  console.log(`file: ${getConfigPath(claudeConfigDir)}`);
}

async function cmdModel(claudeConfigDir: string, args: string[]): Promise<void> {
  const prices = await loadPrices(claudeConfigDir);
  const config = await loadConfig(claudeConfigDir);
  const pricesPath = getPricesPath(claudeConfigDir);

  if (args[0] === "list") {
    if (!prices.models || Object.keys(prices.models).length === 0) {
      die(`no price table yet (${pricesPath}); open a session and wait a moment, then retry`);
    }
    for (const [name, p] of Object.entries(prices.models)) {
      console.log(`${name}  (in $${p.in}/MTok)`);
    }
    return;
  }

  if (args.length === 0) {
    const v = config.BASE_MODEL;
    console.log(`base model: ${v || `${DEFAULT_BASE_MODEL} (default)`}`);
    return;
  }

  const want = args.join(" ");
  if (!prices.models || Object.keys(prices.models).length === 0) {
    die(`no price table yet (${pricesPath}); cannot validate '${want}'`);
  }

  // Exact match (case-insensitive), with or without "Claude " prefix
  const lowerWant = want.toLowerCase();
  let matched: string | undefined;
  for (const name of Object.keys(prices.models)) {
    const lowerName = name.toLowerCase();
    if (lowerName === lowerWant || lowerName === `claude ${lowerWant}`) {
      matched = name;
      break;
    }
  }

  if (!matched) {
    console.error(`error: unknown model '${want}'. Known:`);
    for (const name of Object.keys(prices.models)) {
      console.error(name);
    }
    process.exit(1);
  }

  await putSetting(claudeConfigDir, "BASE_MODEL", matched);
  console.log(`base model: ${matched}`);
}

function sectionsStatus(config: ConfigSettings): void {
  const cur = currentSections(config).split(",");
  let hidden = "";
  for (const s of ALL_SECTIONS) {
    if (!cur.includes(s)) hidden += ` ${s}`;
  }
  console.log(`enabled: ${cur.join(" ")}`);
  console.log(`hidden: ${hidden || " (none)"}`);
  console.log(`names:   ${ALL_SECTIONS.join(" ")}   (stats = always show the cache hit rate (default: only when below 80%))`);
  console.log(`change:  sections show|hide|only NAME...   or   sections all`);
}

async function saveSections(claudeConfigDir: string, enabled: string[]): Promise<void> {
  const config = await loadConfig(claudeConfigDir);
  const before = currentSections(config);

  // Ensure canonical order
  const out = ALL_SECTIONS.filter((s) => enabled.includes(s)).join(",");
  if (!out) die("at least one section must stay enabled");

  await putSetting(claudeConfigDir, "SECTIONS", out);

  let hidden = "";
  for (const s of ALL_SECTIONS) {
    if (!enabled.includes(s)) hidden += ` ${s}`;
  }

  if (before === out) {
    console.log(`no change (already: ${out})`);
  } else {
    console.log("sections updated");
  }
  console.log(`enabled: ${out.replace(/,/g, " ")}`);
  console.log(`hidden: ${hidden || " (none)"}`);
}

async function cmdSections(claudeConfigDir: string, args: string[]): Promise<void> {
  const config = await loadConfig(claudeConfigDir);
  const cur = currentSections(config).split(",");

  if (args.length === 0 || args[0] === "list" || args[0] === "status") {
    sectionsStatus(config);
    return;
  }

  const sub = args[0];
  const names = args.slice(1);

  for (const n of names) {
    if (!validSection(n)) die(`unknown section '${n}' (one of: ${ALL_SECTIONS.join(", ")})`);
  }

  switch (sub) {
    case "show":
      await saveSections(claudeConfigDir, [...cur, ...names]);
      break;
    case "only":
      await saveSections(claudeConfigDir, names);
      break;
    case "hide": {
      const remaining = cur.filter((s) => !names.includes(s));
      await saveSections(claudeConfigDir, remaining);
      break;
    }
    case "all":
      await dropSettings(claudeConfigDir, ["SECTIONS"]);
      console.log("sections: all enabled");
      break;
    default:
      die(`sections: expected show|hide|only NAME..., all or list, got '${sub}'`);
  }
}

async function cmdResets(claudeConfigDir: string, args: string[]): Promise<void> {
  const config = await loadConfig(claudeConfigDir);

  if (args.length === 0) {
    const v = config.RESETS;
    console.log(`resets: ${v || `${DEFAULT_RESETS} (default)`}`);
    return;
  }

  if (args.length !== 1) die("resets: one comma-separated list, e.g. 5h,7d,spend");

  const list = args[0];
  if (/[^A-Za-z0-9_,-]/.test(list)) die("resets: use a comma list of window names, e.g. 5h,7d,spend");

  await putSetting(claudeConfigDir, "RESETS", list);
  console.log(`resets: ${list}`);
  console.log("only the windows named here are shown (default: 5h,7d,spend; spend exists only on gateway accounts). Undo: reset RESETS");
}

async function cmdThresholds(claudeConfigDir: string, args: string[]): Promise<void> {
  if (args.length < 3) die("thresholds: expected context|resets|cache|overhead WARN CRIT");

  const what = args[0];
  const warn = parseInt(args[1], 10);
  const crit = parseInt(args[2], 10);

  if (isNaN(warn) || isNaN(crit)) die("thresholds: WARN and CRIT must be whole numbers");

  let pre: string;
  switch (what) {
    case "context":
      pre = "CONTEXT";
      if (!(warn < crit && crit <= 100)) die("context: need WARN < CRIT <= 100");
      break;
    case "resets":
      pre = "RESET";
      if (!(warn < crit && crit <= 100)) die("resets: need WARN < CRIT <= 100");
      break;
    case "cache":
      pre = "CACHE";
      if (!(crit < warn)) die("cache: CRIT minutes must be lower than WARN (red comes later, as time runs out)");
      break;
    case "overhead":
      pre = "OVERHEAD";
      if (!(warn < crit)) die("overhead: need WARN < CRIT (cents per call)");
      break;
    default:
      die("thresholds: expected context|resets|cache|overhead WARN CRIT");
  }

  await putSettings(claudeConfigDir, [
    [`${pre}_WARN`, String(warn)],
    [`${pre}_CRIT`, String(crit)],
  ]);

  const unit = what === "cache" ? " minutes left" : what === "overhead" ? " cents per call" : "%";
  console.log(`${what}: yellow at ${warn}, red at ${crit}${unit}`);
}

async function cmdWidth(claudeConfigDir: string, args: string[]): Promise<void> {
  const config = await loadConfig(claudeConfigDir);

  if (args.length === 0) {
    const v = config.WIDTH;
    console.log(`width: ${v || "auto"}`);
    return;
  }

  if (args[0] === "auto") {
    await dropSettings(claudeConfigDir, ["WIDTH"]);
    console.log("width: auto");
    return;
  }

  if (!isInt(args[0]) || parseInt(args[0], 10) <= 0) die("width: a positive number of columns, or auto");

  await putSetting(claudeConfigDir, "WIDTH", args[0]);
  console.log(`width: ${args[0]}`);
}

async function cmdMargin(claudeConfigDir: string, args: string[]): Promise<void> {
  const config = await loadConfig(claudeConfigDir);

  if (args.length === 0) {
    const v = config.MARGIN;
    console.log(`margin: ${v || `${DEFAULT_MARGIN} (default)`}`);
    return;
  }

  if (!isInt(args[0])) die("margin: a number of columns");

  await putSetting(claudeConfigDir, "MARGIN", args[0]);
  console.log(`margin: ${args[0]}`);
}

async function cmdOverhead(claudeConfigDir: string, args: string[]): Promise<void> {
  const config = await loadConfig(claudeConfigDir);

  if (args.length === 0) {
    const fresh = config.FRESH_TOKENS || String(DEFAULT_FRESH_TOKENS);
    const summary = config.SUMMARY_TOKENS || String(DEFAULT_SUMMARY_TOKENS);
    console.log(`overhead: fresh ${fresh} summary ${summary} (empty = default ${DEFAULT_FRESH_TOKENS} / ${DEFAULT_SUMMARY_TOKENS})`);
    return;
  }

  if (!isInt(args[0]) || parseInt(args[0], 10) <= 0) die("overhead: FRESH must be a positive token count");

  const entries: Array<[string, string]> = [["FRESH_TOKENS", args[0]]];
  if (args[1]) {
    if (!isInt(args[1]) || parseInt(args[1], 10) <= 0) die("overhead: SUMMARY must be a positive token count");
    entries.push(["SUMMARY_TOKENS", args[1]]);
  }

  await putSettings(claudeConfigDir, entries);
  console.log(`overhead: fresh ${args[0]} summary ${args[1] || "unchanged"}`);
}

async function cmdDump(claudeConfigDir: string, args: string[]): Promise<void> {
  const config = await loadConfig(claudeConfigDir);

  if (args.length === 0) {
    const v = config.DUMP;
    console.log(`dump: ${v || "off"}`);
    return;
  }

  if (args[0] === "off") {
    await dropSettings(claudeConfigDir, ["DUMP"]);
    console.log("dump: off");
    return;
  }

  await putSetting(claudeConfigDir, "DUMP", args[0]);
  console.log(`dump: ${args[0]}`);
}

async function cmdReset(claudeConfigDir: string, args: string[]): Promise<void> {
  const validKeys = [
    "BASE_MODEL",
    "SECTIONS",
    "RESETS",
    "CONTEXT_WARN",
    "CONTEXT_CRIT",
    "CACHE_WARN",
    "CACHE_CRIT",
    "RESET_WARN",
    "RESET_CRIT",
    "WIDTH",
    "MARGIN",
    "DUMP",
    "FRESH_TOKENS",
    "SUMMARY_TOKENS",
    "OVERHEAD_WARN",
    "OVERHEAD_CRIT",
  ];

  if (args.length === 0) {
    await resetAllSettings(claudeConfigDir);
    console.log("all saved settings removed");
  } else {
    for (const k of args) {
      if (!validKeys.includes(k)) die(`invalid key: ${k}`);
    }
    await dropSettings(claudeConfigDir, args as any);
    console.log(`removed: ${args.join(" ")}`);
  }
}

export async function runConfig(argv: string[]): Promise<void> {
  const claudeConfigDir = getClaudeConfigDir();
  const { command, args } = parseArgs(argv);

  switch (command) {
    case "show":
      await cmdShow(claudeConfigDir);
      break;
    case "model":
      await cmdModel(claudeConfigDir, args);
      break;
    case "sections":
      await cmdSections(claudeConfigDir, args);
      break;
    case "resets":
      await cmdResets(claudeConfigDir, args);
      break;
    case "thresholds":
      await cmdThresholds(claudeConfigDir, args);
      break;
    case "width":
      await cmdWidth(claudeConfigDir, args);
      break;
    case "margin":
      await cmdMargin(claudeConfigDir, args);
      break;
    case "overhead":
      await cmdOverhead(claudeConfigDir, args);
      break;
    case "dump":
      await cmdDump(claudeConfigDir, args);
      break;
    case "reset":
      await cmdReset(claudeConfigDir, args);
      break;
    case "help":
    case "-h":
    case "--help":
    case "":
      usage();
      break;
    default:
      usage();
      process.exit(1);
  }
}