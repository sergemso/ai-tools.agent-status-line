// Config file read/write (atomic, KEY=value lines)
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let configCache = null;
export function getConfigPath(claudeConfigDir) {
    return join(claudeConfigDir, "statusline", "config");
}
export async function loadConfig(claudeConfigDir) {
    const path = getConfigPath(claudeConfigDir);
    const data = {};
    try {
        const content = await fs.readFile(path, "utf-8");
        for (const line of content.split("\n")) {
            const idx = line.indexOf("=");
            if (idx > 0) {
                const key = line.slice(0, idx).trim();
                const value = line.slice(idx + 1).trim();
                if (key)
                    data[key] = value;
            }
        }
    }
    catch {
        // File doesn't exist or unreadable - return empty
    }
    configCache = { path, data };
    return data;
}
export function getCachedConfig() {
    return configCache?.data ?? null;
}
export function getSetting(data, key) {
    return data[key];
}
export function hasSetting(data, key) {
    return key in data;
}
export async function putSetting(claudeConfigDir, key, value) {
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
export async function putSettings(claudeConfigDir, entries) {
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
export async function dropSettings(claudeConfigDir, keys) {
    const path = getConfigPath(claudeConfigDir);
    const data = configCache?.data ?? (await loadConfig(claudeConfigDir));
    for (const key of keys) {
        delete data[key];
    }
    if (Object.keys(data).length === 0) {
        try {
            await fs.unlink(path);
        }
        catch {
            // Ignore
        }
        configCache = { path, data: {} };
    }
    else {
        const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
        const lines = Object.entries(data).map(([k, v]) => `${k}=${v}`);
        await fs.writeFile(tmp, lines.join("\n") + "\n", { mode: 0o644 });
        await fs.rename(tmp, path);
        configCache = { path, data };
    }
}
export async function resetAllSettings(claudeConfigDir) {
    const path = getConfigPath(claudeConfigDir);
    try {
        await fs.unlink(path);
    }
    catch {
        // Ignore
    }
    configCache = { path, data: {} };
}
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    }
    catch {
        // Ignore
    }
}
//# sourceMappingURL=config-file.js.map