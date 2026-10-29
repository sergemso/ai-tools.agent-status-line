// Config utilities shared between modules

import { join } from "path";

export function getClaudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "~", ".claude");
}