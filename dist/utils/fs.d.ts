/**
 * Atomic write: write to temp file then rename
 */
export declare function atomicWrite(path: string, content: string | Buffer, mode?: number): Promise<void>;
/**
 * Directory-based lock (mkdir is atomic)
 * Returns true if lock acquired, false if already locked
 */
export declare function tryLock(lockPath: string, staleAfterMs?: number): Promise<boolean>;
/**
 * Release a directory lock
 */
export declare function releaseLock(lockPath: string): Promise<void>;
/**
 * Read file mtime in milliseconds
 */
export declare function getMtime(path: string): Promise<number>;
//# sourceMappingURL=fs.d.ts.map