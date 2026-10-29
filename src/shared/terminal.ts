// Terminal width detection and visible width calculation

import { spawn } from "child_process";
import { promises as fs } from "fs";
import { ALL_BLOCK_CHARS } from "./constants.js";

/**
 * Detect terminal columns from /dev/tty or parent process tty
 * Returns 0 if unable to detect
 */
export async function detectCols(): Promise<number> {
  // Try /dev/tty first using Node.js fs
  try {
    const result = await runCommand("stty", ["size"]);
    if (result.code === 0 && result.stdout) {
      const cols = parseInt(result.stdout.trim().split(" ")[1], 10);
      if (!isNaN(cols) && cols > 0) return cols;
    }
  } catch {
    // Ignore, try fallback
  }

  // Fallback: walk up process tree to find a tty
  let pid = process.pid;
  for (let i = 0; i < 8; i++) {
    try {
      const ppidResult = await runCommand("ps", ["-o", "ppid=", "-p", String(pid)]);
      if (ppidResult.code !== 0 || !ppidResult.stdout.trim()) break;
      pid = parseInt(ppidResult.stdout.trim(), 10);
      if (pid <= 1) break;

      const ttyResult = await runCommand("ps", ["-o", "tty=", "-p", String(pid)]);
      if (ttyResult.code !== 0) continue;
      const tty = ttyResult.stdout.trim();
      if (!tty || tty === "?" || tty === "??" || tty === "-") continue;

      // Try to read stty size from the tty device
      try {
        const sttyResult = await runCommand("stty", ["size", "-F", `/dev/${tty}`]);
        if (sttyResult.code === 0 && sttyResult.stdout) {
          const cols = parseInt(sttyResult.stdout.trim().split(" ")[1], 10);
          if (!isNaN(cols) && cols > 0) return cols;
        }
      } catch {
        // Ignore
      }
    } catch {
      continue;
    }
  }

  return 0;
}

/**
 * Calculate visible width of a string (strip ANSI codes, count block chars as 1)
 */
export function visibleWidth(str: string): number {
  // Strip ANSI escape sequences
  let t = str.replace(/\x1b\[[0-9;]*m/g, "");

  // Replace each block character with a single placeholder
  for (const ch of ALL_BLOCK_CHARS) {
    t = t.split(ch).join("x");
  }

  return t.length;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCommand(cmd: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
    child.on("error", (err) => resolve({ code: 1, stdout, stderr: err.message }));
  });
}