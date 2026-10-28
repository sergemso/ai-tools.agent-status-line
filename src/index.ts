// Main CLI entry point

import { generateStatusLine } from "./statusline.js";
import { runConfig } from "./config.js";
import { refreshPrices } from "./refresh-prices.js";
import { install } from "./install.js";
import { getClaudeConfigDir } from "utils/config-utils.js";

interface ParsedArgs {
  command: string;
  args: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) return { command: "statusline", args: [] };
  return { command: argv[0], args: argv.slice(1) };
}

async function main() {
  const argv = process.argv.slice(2);
  const { command, args } = parseArgs(argv);

  switch (command) {
    case "statusline": {
      // Read from stdin
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const input = Buffer.concat(chunks).toString("utf-8");
      const line = await generateStatusLine(input);
      console.log(line);
      break;
    }

    case "config": {
      await runConfig(args);
      break;
    }

    case "refresh-prices": {
      const claudeConfigDir = getClaudeConfigDir();
      const ttl = parseInt(process.env.STATUSLINE_PRICES_TTL || "3600", 10);
      await refreshPrices(claudeConfigDir, ttl);
      break;
    }

    case "install": {
      let configure = false;
      let force = false;
      let interval = 15;

      for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
          case "--configure":
            configure = true;
            break;
          case "--force":
            force = true;
            break;
          case "--interval":
            interval = parseInt(args[++i], 10);
            if (isNaN(interval) || interval <= 0) {
              console.error("--interval needs a positive number of seconds");
              process.exit(1);
            }
            break;
          default:
            console.error(`unknown option: ${args[i]}`);
            process.exit(1);
        }
      }

      if (configure) {
        await install({ configure, force, interval });
      }
      break;
    }

    case "help":
    case "-h":
    case "--help":
      console.log(`claude-code-status-line - TypeScript rewrite

Usage: statusline <command> [args]

Commands:
  statusline          Generate status line (reads JSON from stdin)
  config <subcommand> Manage settings
  refresh-prices      Fetch and cache model prices
  install             Install/copy scripts and optionally configure settings.json

Config subcommands:
  show                Show current settings
  model [NAME|list]   Base model for price multiplier
  sections ...        Show/hide sections
  resets LIST         Which reset windows to show
  thresholds ...      Yellow/red breakpoints
  width [N|auto]      Terminal width
  margin N            Right margin
  overhead [FRESH [SUMMARY]]  Token sizes for overhead metric
  dump [PATH|off]     Debug dump path
  reset [KEY...]      Drop saved settings

Install options:
  --configure         Configure settings.json
  --force             Replace existing statusLine
  --interval SECONDS  Refresh interval (default 15)

Run 'statusline config help' for detailed config help.`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'statusline help' for usage");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});