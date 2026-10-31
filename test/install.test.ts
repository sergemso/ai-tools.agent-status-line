import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { uninstall } from "../src/install.js";

describe("uninstall", () => {
  let dir: string;
  let prev: string | undefined;
  const bin = () => join(dir, "statusline", "statusline");
  const cfg = () => join(dir, "statusline", "config");
  const settings = () => join(dir, "settings.json");

  beforeEach(() => {
    prev = process.env.CLAUDE_CONFIG_DIR;
    dir = mkdtempSync(join(tmpdir(), "sl-uninstall-"));
    process.env.CLAUDE_CONFIG_DIR = dir;
    mkdirSync(join(dir, "statusline"));
    writeFileSync(bin(), "#!/bin/sh\n");
    writeFileSync(cfg(), "FORMAT=glyph\n");
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  });

  it("drops our statusLine and binary, keeps other settings and the config", async () => {
    writeFileSync(
      settings(),
      JSON.stringify({ theme: "dark", statusLine: { type: "command", command: bin() } }),
    );
    await uninstall({ purge: false });
    expect(JSON.parse(readFileSync(settings(), "utf-8"))).toEqual({ theme: "dark" });
    expect(existsSync(bin())).toBe(false);
    expect(existsSync(cfg())).toBe(true);
  });

  it("leaves a statusLine that points elsewhere", async () => {
    const other = { type: "command", command: "/usr/local/bin/other" };
    writeFileSync(settings(), JSON.stringify({ statusLine: other }));
    await uninstall({ purge: false });
    expect(JSON.parse(readFileSync(settings(), "utf-8")).statusLine).toEqual(other);
  });

  it("--purge also deletes the config and the empty directory", async () => {
    writeFileSync(settings(), JSON.stringify({}));
    await uninstall({ purge: true });
    expect(existsSync(cfg())).toBe(false);
    expect(existsSync(join(dir, "statusline"))).toBe(false);
  });

  it("works with no settings.json and no binary", async () => {
    rmSync(bin());
    await expect(uninstall({ purge: false })).resolves.toBeUndefined();
  });
});
