// Config file read/write (atomic, KEY=value lines)

import { ConfigSettings } from "./types.js";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ConfigFile {
  path: string;
  data: ConfigSettings;
}

let configCache: ConfigFile | null = null;

export function getConfigPath(claudeConfigDir: string): string {
  return join(claudeConfigDir, "statusline", "config");
}

export async function loadConfig(claudeConfigDir: string): Promise<ConfigSettings> {
  const path = getConfigPath(claudeConfigDir);
  const data: ConfigSettings = {};

  try {
    const content = await fs.readFile(path, "utf-8");
    for (const line of content.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) data[key] = value;
      }
    }
  } catch {
    // File doesn't exist or unreadable - return empty
  }

  configCache = { path, data };
  return data;
}

export function getCachedConfig(): ConfigSettings | null {
  return configCache?.data ?? null;
}

export function getSetting(data: ConfigSettings, key: keyof ConfigSettings): string | undefined {
  return data[key];
}

export function hasSetting(data: ConfigSettings, key: keyof ConfigSettings): boolean {
  return key in data;
}

export async function putSetting(
  claudeConfigDir: string,
  key: keyof ConfigSettings,
  value: string
): Promise<void> {
  const path = getConfigPath(claudeConfigDir);
  await ensureDir(dirname(path));

  // Read current
  const data = configCache?.data ?? (await loadConfig(claudeConfigDir));
  data[key] = value;

  // Atomic write
  const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const lines = Object.entries(data).map(([k, v]) => `${k}=${v}`);
  await fs.writeFile(tmp, lines.join("\n") + "\n", { mode: 0o644 });
  await fs.rename(tmp, path);

  configCache = { path, data };
}

export async function putSettings(
  claudeConfigDir: string,
  entries: Array<[keyof ConfigSettings, string]>
): Promise<void> {
  const path = getConfigPath(claudeConfigDir);
  await ensureDir(dirname(path));

  const data = configCache?.data ?? (await loadConfig(claudeConfigDir));
  for (const [key, value] of entries) {
    data[key] = value;
  }

  const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const lines = Object.entries(data).map(([k, v]) => `${k}=${v}`);
  await fs.writeFile(tmp, lines.join("\n") + "\n", { mode: 0o644 });
  await fs.rename(tmp, path);

  configCache = { path, data };
}

export async function dropSettings(
  claudeConfigDir: string,
  keys: (keyof ConfigSettings)[]
): Promise<void> {
  const path = getConfigPath(claudeConfigDir);

  const data = configCache?.data ?? (await loadConfig(claudeConfigDir));
  for (const key of keys) {
    delete data[key];
  }

  if (Object.keys(data).length === 0) {
    try {
      await fs.unlink(path);
    } catch {
      // Ignore
    }
    configCache = { path, data: {} };
  } else {
    const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const lines = Object.entries(data).map(([k, v]) => `${k}=${v}`);
    await fs.writeFile(tmp, lines.join("\n") + "\n", { mode: 0o644 });
    await fs.rename(tmp, path);
    configCache = { path, data };
  }
}

export async function resetAllSettings(claudeConfigDir: string): Promise<void> {
  const path = getConfigPath(claudeConfigDir);
  try {
    await fs.unlink(path);
  } catch {
    // Ignore
  }
  configCache = { path, data: {} };
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Ignore
  }
}