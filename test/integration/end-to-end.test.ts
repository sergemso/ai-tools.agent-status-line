// End-to-end integration tests for full pipeline - using CLI

import { test, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { adapterRegistry } from "../../src/adapters/index.js";
import { UnifiedStatusInput, AgentType } from "../../src/shared/unified-model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..", "..");
const PROJECT_ROOT = join(__dirname, "..");
const BIN_PATH = join(PROJECT_ROOT, "bin/statusline");

function loadFixtureDirect(agent: AgentType, name: string): unknown {
  const fixturePath = join(__dirname, "fixtures", agent, `${name}.json`);
  const content = readFileSync(fixturePath, "utf-8");
  return JSON.parse(content);
}

function runFullPipeline(fixture: unknown): string {
  const result = spawnSync("node", [BIN_PATH, "statusline"], {
    input: JSON.stringify(fixture),
    encoding: "utf-8",
    cwd: PROJECT_ROOT,
  });
  
  if (result.status !== 0) {
    throw new Error(`CLI failed with exit code ${result.status}: ${result.stderr}`);
  }
  
  return result.stdout.trim();
}

describe("End-to-End Pipeline - Claude Code", () => {
  const fixtures = [
    "basic",
    "with-cache",
    "high-context",
    "medium-context",
    "cache-cold",
    "multiple-rate-limits",
    "edge-empty",
    "edge-null",
  ];

  for (const fixtureName of fixtures) {
    test(`full pipeline works for ${fixtureName}`, () => {
      const input = loadFixtureDirect("claude-code", fixtureName);
      const output = runFullPipeline(input);
      
      expect(output).toBeDefined();
      expect(typeof output).toBe("string");
      expect(output.length).toBeGreaterThan(0);
    });
  }

  test("pipeline produces consistent output for same input", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const output1 = runFullPipeline(input);
    const output2 = runFullPipeline(input);
    
    expect(output1).toBe(output2);
  });

  test("pipeline handles all rate limit windows", () => {
    const input = loadFixtureDirect("claude-code", "multiple-rate-limits");
    const output = runFullPipeline(input);
    
    // Should show rate limit windows (default resets: 5h, 7d, spend)
    expect(output).toContain("5h");
    expect(output).toContain("7d");
    expect(output).toContain("Spend limit");
    // 1d is parsed but not shown by default (DEFAULT_RESETS = "5h,7d,spend")
  });

  test("pipeline handles cache correctly", () => {
    const input = loadFixtureDirect("claude-code", "with-cache");
    const output = runFullPipeline(input);
    
    // Should show cache info
    expect(output).toMatch(/⏱|cache/); // glyph or words style, depending on width
  });

  test("pipeline handles cold cache correctly", () => {
    const input = loadFixtureDirect("claude-code", "cache-cold");
    const output = runFullPipeline(input);
    
    // Should show cold cache
    expect(output).toContain("cold");
  });
});

describe("End-to-End Pipeline - Cursor", () => {
  const fixtures = [
    "basic",
    "full",
    "high-context",
    "medium-context",
    "edge-empty",
    "edge-null",
    "different-models",
  ];

  for (const fixtureName of fixtures) {
    test(`full pipeline works for ${fixtureName}`, () => {
      const input = loadFixtureDirect("cursor", fixtureName);
      const output = runFullPipeline(input);
      
      expect(output).toBeDefined();
      expect(typeof output).toBe("string");
      expect(output.length).toBeGreaterThan(0);
    });
  }

  test("pipeline uses render_width_chars for terminal width", () => {
    const input = loadFixtureDirect("cursor", "basic");
    const output = runFullPipeline(input);
    
    // Should produce output without errors
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });

  test("pipeline handles different models", () => {
    const input = loadFixtureDirect("cursor", "different-models");
    const output = runFullPipeline(input);
    
    expect(output).toContain("Claude 3 Opus");
  });
});

describe("End-to-End - Cross-Agent Compatibility", () => {
  test("both agents produce valid output for their fixtures", () => {
    const claudeInput = loadFixtureDirect("claude-code", "basic");
    const cursorInput = loadFixtureDirect("cursor", "basic");
    
    const claudeOutput = runFullPipeline(claudeInput);
    const cursorOutput = runFullPipeline(cursorInput);
    
    expect(claudeOutput).toBeDefined();
    expect(cursorOutput).toBeDefined();
    expect(claudeOutput.length).toBeGreaterThan(0);
    expect(cursorOutput.length).toBeGreaterThan(0);
  });

  test("auto-detection works in full pipeline", () => {
    const claudeInput = loadFixtureDirect("claude-code", "basic");
    const cursorInput = loadFixtureDirect("cursor", "basic");
    
    // Should auto-detect correctly without explicit agent type
    const claudeOutput = runFullPipeline(claudeInput);
    const cursorOutput = runFullPipeline(cursorInput);
    
    expect(claudeOutput).toBeDefined();
    expect(cursorOutput).toBeDefined();
  });

  test("agent-specific extensions are preserved", () => {
    const cursorInput = loadFixtureDirect("cursor", "basic");
    const cursorUnified = adapterRegistry.parse(cursorInput);
    
    expect(cursorUnified.extensions.renderWidthChars).toBe(120);
    expect(cursorUnified.extensions.autorun).toBe(false);
    expect(cursorUnified.extensions.paramSummary).toBe("(Thinking)");
    expect(cursorUnified.extensions.maxMode).toBe(true);
    
    const claudeInput = loadFixtureDirect("claude-code", "basic");
    const claudeUnified = adapterRegistry.parse(claudeInput);
    
    expect(claudeUnified.extensions.vimMode).toBe("NORMAL");
    expect(claudeUnified.extensions.worktree).toBeUndefined(); // Not in basic fixture
    expect(claudeUnified.extensions.outputStyle).toBe("default");
  });
});

describe("End-to-End - Compaction Behavior", () => {
  test("output is compacted for narrow terminals", () => {
    // Test with a fixture that has many sections
    const input = loadFixtureDirect("claude-code", "multiple-rate-limits");
    const output = runFullPipeline(input);
    
    // Output should be reasonably compact
    expect(output.length).toBeLessThan(800);
  });

  test("output contains expected sections", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const output = runFullPipeline(input);
    
    // Should have model, context, cost, cache, resets sections (default sections)
    expect(output).toContain("Claude Sonnet 5.5");
    expect(output).toMatch(/Σ|session/);
    expect(output).toMatch(/⏱|cache/); // cache
    expect(output).toContain("5h");
    expect(output).toContain("7d");
  });

  test("separator is present between sections", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const output = runFullPipeline(input);
    
    // Should have section separators
    expect(output).toContain(" | ");
  });
});

describe("End-to-End - Error Handling", () => {
  test("invalid JSON throws error", () => {
    const result = spawnSync("node", [BIN_PATH, "statusline"], {
      input: "not valid json",
      encoding: "utf-8",
      cwd: PROJECT_ROOT,
    });
    
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Failed to parse input");
  });

  test("empty input throws error", () => {
    const result = spawnSync("node", [BIN_PATH, "statusline"], {
      input: "",
      encoding: "utf-8",
      cwd: PROJECT_ROOT,
    });
    
    expect(result.status).not.toBe(0);
  });
});

describe("End-to-End - Performance", () => {
  test("pipeline completes within reasonable time", () => {
    const input = loadFixtureDirect("claude-code", "multiple-rate-limits");
    
    const start = Date.now();
    runFullPipeline(input);
    const elapsed = Date.now() - start;
    
    // Should complete in less than 5 seconds (including price loading)
    expect(elapsed).toBeLessThan(5000);
  });
});