export interface ShellResult {
    code: number;
    stdout: string;
    stderr: string;
}
/**
 * Run a shell command and return result
 */
export declare function runShell(command: string, args: string[], options?: {
    cwd?: string;
    env?: Record<string, string>;
}): Promise<ShellResult>;
/**
 * Run a command through bash -c
 */
export declare function runBash(script: string, options?: {
    cwd?: string;
    env?: Record<string, string>;
}): Promise<ShellResult>;
//# sourceMappingURL=shell.d.ts.map