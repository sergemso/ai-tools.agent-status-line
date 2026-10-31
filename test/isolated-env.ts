// Environment for tests that spawn the built binary.
//
// The binary reads settings (~/.claude/statusline/config) and the price table
// (~/.claude/model-prices.json) from CLAUDE_CONFIG_DIR. Point it at a throwaway
// directory so a developer's own FORMAT/SEPARATOR settings cannot change the
// output, and seed the price table so the binary never tries the network.

import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";

const FIXTURE_PRICES = join(fileURLToPath(import.meta.url), "..", "fixtures", "model-prices.json");

export interface IsolatedEnv {
  readonly env: NodeJS.ProcessEnv;
  readonly dir: string;
  cleanup(): void;
}

export function isolatedEnv(extra: NodeJS.ProcessEnv = {}): IsolatedEnv {
  const dir = mkdtempSync(join(tmpdir(), "sl-test-"));
  mkdirSync(join(dir, "statusline"));
  copyFileSync(FIXTURE_PRICES, join(dir, "model-prices.json"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CONFIG_DIR: dir,
    // A year: the seeded table is never considered stale, so no refresh runs.
    STATUSLINE_PRICES_TTL: "31536000",
    ...extra,
  };
  for (const key of Object.keys(env)) {
    if (key.startsWith("STATUSLINE_") && !(key in extra) && key !== "STATUSLINE_PRICES_TTL") {
      delete env[key];
    }
  }
  return { env, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
