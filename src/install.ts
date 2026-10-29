// Installer: copy scripts and configure settings.json

import { join } from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { getClaudeConfigDir } from "utils/config-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

interface InstallOptions {
  configure: boolean;
  force: boolean;
  interval: number;
}

async function copyScripts(srcDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  // Determine if we're running from the bundled executable or from source
  // Bundled executable is in bin/statusline, source is in src/
  const isBundled = __filename.includes("/bin/statusline") || __filename.includes("\\bin\\statusline");

  if (isBundled) {
    // Production: copy the bundled executable
    const executable = join(__dirname, "statusline");
    const dest = join(destDir, "statusline");
    try {
      await fs.copyFile(executable, dest);
      await fs.chmod(dest, 0o755);
    } catch {
      console.warn("Could not find compiled executable, skipping copy");
    }
  } else {
    // Development: copy the compiled JS files from dist/
    const jsScripts = ["statusline.js", "config.js", "refresh-prices.js"];
    for (const script of jsScripts) {
      const src = join(__dirname, "..", "dist", script);
      const dest = join(destDir, script.replace(".js", ""));
      try {
        await fs.copyFile(src, dest);
        await fs.chmod(dest, 0o755);
      } catch {
        // Ignore if source doesn't exist
      }
    }
  }
}

async function configureSettings(
  claudeConfigDir: string,
  destDir: string,
  options: InstallOptions
): Promise<void> {
  const settingsPath = join(claudeConfigDir, "settings.json");
  const executablePath = join(destDir, "statusline");
  // The executable is a Node.js ESM bundle, run with node
  const cmd = `node ${executablePath}`;

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
    console.log(`statusLine already set to: ${currentCmd} (re-run with --force to replace)`);
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

  console.log(`statusLine set to: ${cmd} (refresh every ${options.interval}s)`);
}

export async function install(options: InstallOptions): Promise<void> {
  const claudeConfigDir = getClaudeConfigDir();
  const destDir = join(claudeConfigDir, "statusline");
  const srcDir = join(__dirname, "..", "src");

  await copyScripts(srcDir, destDir);

  if (options.configure) {
    await configureSettings(claudeConfigDir, destDir, options);
  }
}