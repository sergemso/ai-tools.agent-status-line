// Shell command execution

export interface ShellResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a shell command and return result
 */
export async function runShell(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
): Promise<ShellResult> {
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
export async function runBash(
  script: string,
  options: { cwd?: string; env?: Record<string, string> } = {}
): Promise<ShellResult> {
  return runShell("bash", ["-c", script], options);
}