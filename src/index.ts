// Main CLI entry point

import { generateStatusLine } from "./statusline.js";
import { runConfig } from "./config.js";
import { refreshPrices } from "./refresh-prices.js";
import { install, uninstall } from "./install.js";
import { getClaudeConfigDir } from "utils/config-utils.js";
import { adapterRegistry, AgentType } from "adapters/index.js";

interface ParsedArgs {
  command: string;
  args: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) return { command: "statusline", args: [] };
  return { command: argv[0], args: argv.slice(1) };
}

async function runAgentCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || "help";
  
  switch (subcommand) {
    case "list": {
      const agents = adapterRegistry.getAgentTypes();
      console.log("Available agents:");
      for (const agent of agents) {
        const adapter = adapterRegistry.get(agent);
        console.log(`  ${agent}${adapter ? "" : " (no adapter)"}`);
      }
      break;
    }
    
    case "detect": {
      if (args.length < 2) {
        console.error("Usage: statusline agent detect <file>");
        process.exit(1);
      }
      const filePath = args[1];
      try {
        const { readFileSync } = await import("fs");
        const input = JSON.parse(readFileSync(filePath, "utf-8"));
        const adapter = adapterRegistry.detect(input);
        if (adapter) {
          console.log(`Detected agent: ${adapter.agentType}`);
        } else {
          console.log("No matching agent detected (would fall back to claude-code)");
        }
      } catch (e) {
        console.error(`Failed to detect agent: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }
      break;
    }
    
    case "current": {
      // For the current agent, we'd need to read from stdin or a config
      // For now, show the default/fallback agent
      const fallback = adapterRegistry.get("claude-code");
      console.log(`Current agent (fallback): ${fallback?.agentType || "claude-code"}`);
      console.log("Note: Agent is auto-detected from input JSON at runtime");
      break;
    }
    
    case "help":
    case "-h":
    case "--help":
    case "": {
      console.log(`Usage: statusline agent <subcommand>
  
Subcommands:
  list          List available agents
  detect <file> Detect agent from input JSON file
  current       Show current agent (fallback)`);
      break;
    }
    
    default: {
      console.error(`Unknown agent subcommand: ${subcommand}`);
      console.error("Run 'statusline agent help' for usage");
      process.exit(1);
    }
  }
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

      await install({ configure, force, interval });
      break;
    }

    case "uninstall": {
      const unknown = args.filter((a) => a !== "--purge");
      if (unknown.length > 0) {
        console.error(`unknown option: ${unknown[0]}`);
        process.exit(1);
      }
      await uninstall({ purge: args.includes("--purge") });
      break;
    }

    case "agent": {
      await runAgentCommand(args);
      break;
    }

    case "help":
    case "-h":
    case "--help":
      console.log(`statusline - agent status line for Claude Code, Cursor and OpenCode

Usage: statusline <command> [args]

Commands:
  statusline          Generate status line (reads JSON from stdin)
  config <subcommand> Manage settings
  refresh-prices      Fetch and cache model prices
  install             Install/copy scripts and optionally configure settings.json
  uninstall           Remove the statusLine entry and the copied binary (--purge also deletes config)
  agent <subcommand>  Manage multi-agent support

Config subcommands:
  show                Show current settings
  model [NAME|list]   Base model for price multiplier
  sections ...        Show/hide sections
  resets LIST         Which reset windows to show
  thresholds ...      Yellow/red breakpoints
  width [N|auto]      Terminal width
  format [STYLE]      Text style: auto, words, short, glyph, ascii
  separator [TEXT]    What is drawn between groups
  wizard              Guided setup
  margin N            Right margin
  overhead [FRESH [SUMMARY]]  Token sizes for overhead metric
  dump [PATH|off]     Debug dump path
  reset [KEY...]      Drop saved settings

Agent subcommands:
  list                List available agents
  detect <file>       Detect agent from input JSON file
  current             Show current agent (fallback)

Install options:
  --configure         Configure settings.json
  --force             Replace existing statusLine
  --interval SECONDS  Refresh interval (default 15)

Uninstall options:
  --purge             Also delete saved settings (default: keep them)

Run 'statusline config help' for detailed config help.
Run 'statusline agent help' for agent command help.`);
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