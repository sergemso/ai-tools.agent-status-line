// Installer: copy the bundled binary and configure the agent's settings.
//
// Works for Claude Code (settings.json statusLine) and prints install
// snippets for Cursor / OpenCode so the user can wire those up too.
//
// The bundled binary at bin/statusline already carries a
// `#!/usr/bin/env node` shebang, so the settings entry can reference it
// directly (no `node` prefix needed) once it has the executable bit.

import { join } from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { getClaudeConfigDir } from "utils/config-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

export interface InstallOptions {
  /** Configure ~/.claude/settings.json with a statusLine entry. */
  configure: boolean;
  /** Replace an existing different statusLine entry. */
  force: boolean;
  /** Refresh interval in seconds (Claude Code only). */
  interval: number;
  /** Skip copying the binary (assume it's already in place). */
  skipCopy?: boolean;
  /** Override the destination directory (defaults to ~/.claude/statusline). */
  destDir?: string;
}

/**
 * Locate the bundled binary relative to the running code.
 *
 * The bundled binary lives at <repo>/bin/statusline. When running from
 * dist/ (development) we resolve up to the repo root; when running from
 * the installed binary itself (production) we look in the same dir.
 */
async function locateBinary(): Promise<string | null> {
  const candidates = [
    // Running from the bundled binary itself: bin/statusline
    join(__dirname, "statusline"),
    // Running from dist/install.js: ../bin/statusline
    join(__dirname, "..", "bin", "statusline"),
    // Running from src/install.ts via tsx: ../bin/statusline
    join(__dirname, "..", "..", "bin", "statusline"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

/** Copy the bundled binary to destDir/statusline and chmod it executable. */
async function copyBinary(destDir: string): Promise<string> {
  await fs.mkdir(destDir, { recursive: true });

  const src = await locateBinary();
  if (!src) {
    throw new Error(
      "Could not locate the bundled binary. Run `npm run build` first.",
    );
  }

  const dest = join(destDir, "statusline");
  await fs.copyFile(src, dest);
  await fs.chmod(dest, 0o755);
  return dest;
}

/** Configure ~/.claude/settings.json with a statusLine entry. */
async function configureClaudeCode(
  claudeConfigDir: string,
  executablePath: string,
  options: InstallOptions,
): Promise<void> {
  const settingsPath = join(claudeConfigDir, "settings.json");
  // The binary has a #!/usr/bin/env node shebang, so we reference it
  // directly — no `node` prefix needed.
  const cmd = executablePath;

  // Ensure settings.json exists
  try {
    await fs.access(settingsPath);
  } catch {
    await fs.writeFile(settingsPath, "{}");
  }

  const content = await fs.readFile(settingsPath, "utf-8");
  const settings = JSON.parse(content);

  const currentCmd = settings.statusLine?.command;
  if (currentCmd && currentCmd !== cmd && !options.force) {
    console.log(
      `statusLine already set to: ${currentCmd}\n  Re-run with --force to replace.`,
    );
    return;
  }

  settings.statusLine = {
    type: "command",
    command: cmd,
    refreshInterval: options.interval,
  };

  const tmp = `${settingsPath}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2));
  await fs.rename(tmp, settingsPath);

  console.log(`✓ Claude Code statusLine configured:`);
  console.log(`  command: ${cmd}`);
  console.log(`  refresh: every ${options.interval}s`);
  console.log(`  settings: ${settingsPath}`);
}

/** Print install snippets for Cursor and OpenCode. */
function printOtherAgents(executablePath: string): void {
  console.log("");
  console.log("Other agents (manual one-time setup):");
  console.log("");
  console.log("  Cursor — add to your Cursor settings:");
  console.log(`    "statusLine": { "type": "command", "command": "${executablePath}" }`);
  console.log("");
  console.log("  OpenCode — add to ~/.config/opencode/opencode.json:");
  console.log('    "plugins": ["@statusline/opencode-plugin"]');
  console.log("    (build it first: npm run build --workspace=@statusline/opencode-plugin)");
  console.log("");
  console.log("  See README.md → Agents for details.");
}

/** Main install entry point. */
export async function install(options: InstallOptions): Promise<void> {
  const claudeConfigDir = getClaudeConfigDir();
  const destDir = options.destDir ?? join(claudeConfigDir, "statusline");

  let executablePath: string;
  if (options.skipCopy) {
    executablePath = join(destDir, "statusline");
  } else {
    executablePath = await copyBinary(destDir);
    console.log(`✓ Binary copied to ${executablePath}`);
  }

  if (options.configure) {
    await configureClaudeCode(claudeConfigDir, executablePath, options);
  }

  printOtherAgents(executablePath);
}

export interface UninstallOptions {
  /** Also delete the saved config file (default: keep it). */
  purge: boolean;
  /** Override the directory the binary was copied to (defaults to ~/.claude/statusline). */
  destDir?: string;
}

/**
 * Undo `install --configure`: drop the statusLine entry if it still points
 * at our copied binary, then delete that binary. A statusLine that points
 * somewhere else is left alone.
 */
export async function uninstall(options: UninstallOptions): Promise<void> {
  const claudeConfigDir = getClaudeConfigDir();
  const destDir = options.destDir ?? join(claudeConfigDir, "statusline");
  const binary = join(destDir, "statusline");
  const settingsPath = join(claudeConfigDir, "settings.json");

  let settings: Record<string, any> | null = null;
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
  } catch {
    // no settings.json, or unreadable: nothing to unwire
  }

  if (settings?.statusLine) {
    if (settings.statusLine.command === binary) {
      delete settings.statusLine;
      const tmp = `${settingsPath}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(settings, null, 2));
      await fs.rename(tmp, settingsPath);
      console.log(`✓ Removed statusLine from ${settingsPath}`);
    } else {
      console.log(
        `statusLine points to ${settings.statusLine.command}, not ${binary}; left unchanged.`,
      );
    }
  } else {
    console.log(`No statusLine entry in ${settingsPath}.`);
  }

  try {
    await fs.rm(binary);
    console.log(`✓ Deleted ${binary}`);
  } catch {
    console.log(`No binary at ${binary}.`);
  }

  if (options.purge) {
    await fs.rm(join(destDir, "config"), { force: true });
    console.log(`✓ Deleted ${join(destDir, "config")}`);
    // rmdir only succeeds when the directory is empty
    await fs.rmdir(destDir).catch(() => {});
  } else {
    console.log(`Kept your settings in ${join(destDir, "config")} (use --purge to delete).`);
  }
}
