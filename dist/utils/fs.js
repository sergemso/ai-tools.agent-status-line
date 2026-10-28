// File system utilities: atomic write, lock
import { promises as fs } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Atomic write: write to temp file then rename
 */
export async function atomicWrite(path, content, mode = 0o644) {
    await ensureDir(dirname(path));
    const tmp = `${path}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    await fs.writeFile(tmp, content, { mode });
    await fs.rename(tmp, path);
}
/**
 * Directory-based lock (mkdir is atomic)
 * Returns true if lock acquired, false if already locked
 */
export async function tryLock(lockPath, staleAfterMs = 120000) {
    try {
        // Check for stale lock
        try {
            const stat = await fs.stat(lockPath);
            if (Date.now() - stat.mtimeMs > staleAfterMs) {
                await fs.rmdir(lockPath);
            }
        }
        catch {
            // Lock doesn't exist
        }
        await fs.mkdir(lockPath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Release a directory lock
 */
export async function releaseLock(lockPath) {
    try {
        await fs.rmdir(lockPath);
    }
    catch {
        // Ignore
    }
}
/**
 * Read file mtime in milliseconds
 */
export async function getMtime(path) {
    try {
        const stat = await fs.stat(path);
        return stat.mtimeMs;
    }
    catch {
        return 0;
    }
}
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    }
    catch {
        // Ignore
    }
}
//# sourceMappingURL=fs.js.map