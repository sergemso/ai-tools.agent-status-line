#!/usr/bin/env node
/**
 * postinstall hook — runs automatically after `npm install`.
 *
 * Builds @statusline/core and the main CLI binary if they're not already
 * built, so users can `git clone && npm install` and immediately run
 * `node dist/index.js install --configure` without a separate build step.
 *
 * Silently skips if the build tools (tsc, esbuild) aren't available yet
 * (e.g. during a fresh install where devDependencies are still resolving).
 * In that case the user runs `npm run build` manually.
 */

import { existsSync, statSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const root = join(__dirname, "..");

// Installed from the npm registry: the tarball ships a prebuilt bin/ and dist/
// but no sources, so there is nothing to build.
if (!existsSync(join(root, "src", "index.ts"))) {
  process.exit(0);
}

function isFresh(path) {
  return !existsSync(path);
}

function isStale(path) {
  try {
    const built = statSync(path).mtimeMs;
    const src = statSync(join(root, "src", "index.ts")).mtimeMs;
    return built < src;
  } catch {
    return true;
  }
}

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, stdio: "pipe", shell: true });
  if (result.status !== 0) {
    process.stderr.write(
      `postinstall: ${cmd} ${args.join(" ")} failed (exit ${result.status})\n`,
    );
    return false;
  }
  return true;
}

// 1. Build @statusline/core (other packages depend on it)
const coreDist = join(root, "packages", "core", "dist");
if (isFresh(coreDist)) {
  process.stdout.write("postinstall: building @statusline/core...\n");
  if (!run("npm", ["run", "build:core"])) {
    process.stdout.write(
      "postinstall: skipped core build (run `npm run build:core` manually)\n",
    );
    process.exit(0);
  }
}

// 2. Build the main CLI binary
const binPath = join(root, "bin", "statusline");
if (isFresh(binPath) || isStale(binPath)) {
  process.stdout.write("postinstall: building CLI binary...\n");
  if (!run("npm", ["run", "build"])) {
    process.stdout.write(
      "postinstall: skipped CLI build (run `npm run build` manually)\n",
    );
  }
}

// Ensure the binary is executable (esbuild doesn't set the bit reliably)
if (existsSync(binPath)) {
  try {
    const { chmodSync } = await import("fs");
    chmodSync(binPath, 0o755);
  } catch {
    // non-fatal
  }
}

// 3. Build the opencode plugin (optional, non-fatal)
const opencodeDist = join(root, "packages", "opencode-plugin", "dist");
if (isFresh(opencodeDist)) {
  process.stdout.write("postinstall: building @statusline/opencode-plugin...\n");
  run("npm", ["run", "build", "--workspace=@statusline/opencode-plugin"], root);
  // non-fatal if it fails — the plugin is optional
}

process.stdout.write("postinstall: done.\n");
