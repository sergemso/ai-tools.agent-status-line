// Shell command execution
/**
 * Run a shell command and return result
 */
export async function runShell(command, args, options = {}) {
    const { spawn } = await import("child_process");
    const { cwd, env } = options;
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd,
            env: { ...process.env, ...env },
            shell: true,
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });
        child.on("close", (code) => {
            resolve({ code: code ?? 0, stdout, stderr });
        });
        child.on("error", (err) => {
            resolve({ code: 1, stdout, stderr: err.message });
        });
    });
}
/**
 * Run a command through bash -c
 */
export async function runBash(script, options = {}) {
    return runShell("bash", ["-c", script], options);
}
//# sourceMappingURL=shell.js.map