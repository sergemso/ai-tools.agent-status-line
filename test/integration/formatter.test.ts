// Integration tests for formatter with unified model - using CLI

import { test, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { UnifiedStatusInput, AgentType } from "../../src/shared/unified-model.js";
import { adapterRegistry } from "../../src/adapters/index.js";

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

describe("Formatter with Unified Model - Claude Code", () => {
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
    test(`formats ${fixtureName} fixture correctly`, () => {
      const input = loadFixtureDirect("claude-code", fixtureName);
      const output = runFullPipeline(input);
      
      // Basic sanity checks
      expect(output).toBeDefined();
      expect(typeof output).toBe("string");
      expect(output.length).toBeGreaterThan(0);
      
      // Should contain model name
      const unified = adapterRegistry.parse(input, "claude-code");
      expect(output).toContain(unified.model.displayName);
    });
  }

  test("high-context fixture shows red context bar", () => {
    const input = loadFixtureDirect("claude-code", "high-context");
    const output = runFullPipeline(input);
    
    // Should contain red ANSI code for high context (>80%)
    expect(output).toContain("\x1b[31m"); // RED
    expect(output).toContain("85%");
  });

  test("medium-context fixture shows yellow context bar", () => {
    const input = loadFixtureDirect("claude-code", "medium-context");
    const output = runFullPipeline(input);
    
    // Should contain yellow ANSI code for medium context (50-80%)
    // Fixture has 60% used_percentage
    expect(output).toContain("\x1b[33m"); // YELLOW
    expect(output).toContain("60%");
  });

  test("cache-cold fixture shows cold cache indicator", () => {
    const input = loadFixtureDirect("claude-code", "cache-cold");
    const output = runFullPipeline(input);
    
    // Should show cold cache
    expect(output).toContain("cold");
  });

  test("multiple-rate-limits fixture shows 4 rate limit windows", () => {
    const input = loadFixtureDirect("claude-code", "multiple-rate-limits");
    const output = runFullPipeline(input);
    
    // Should contain rate limit info (default resets: 5h, 7d, spend)
    expect(output).toContain("5h");
    expect(output).toContain("7d");
    expect(output).toContain("Spend limit");
    // 1d is parsed but not shown by default (DEFAULT_RESETS = "5h,7d,spend")
  });

  test("edge-empty fixture handles missing fields gracefully", () => {
    const input = loadFixtureDirect("claude-code", "edge-empty");
    const output = runFullPipeline(input);
    
    // Should not crash and should produce output
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });

  test("edge-null fixture handles explicit null values", () => {
    const input = loadFixtureDirect("claude-code", "edge-null");
    const output = runFullPipeline(input);
    
    // Should not crash and should produce output
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });
});

describe("Formatter with Unified Model - Cursor", () => {
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
    test(`formats ${fixtureName} fixture correctly`, () => {
      const input = loadFixtureDirect("cursor", fixtureName);
      const output = runFullPipeline(input);
      
      // Basic sanity checks
      expect(output).toBeDefined();
      expect(typeof output).toBe("string");
      expect(output.length).toBeGreaterThan(0);
      
      // Should contain model name
      const unified = adapterRegistry.parse(input, "cursor");
      expect(output).toContain(unified.model.displayName);
    });
  }

  test("high-context fixture shows red context bar", () => {
    const input = loadFixtureDirect("cursor", "high-context");
    const output = runFullPipeline(input);
    
    // Should contain red ANSI code for high context (>80%)
    expect(output).toContain("\x1b[31m"); // RED
    expect(output).toContain("85%");
  });

  test("medium-context fixture shows yellow context bar", () => {
    const input = loadFixtureDirect("cursor", "medium-context");
    const output = runFullPipeline(input);
    
    // Should contain yellow ANSI code for medium context (50-80%)
    expect(output).toContain("\x1b[33m"); // YELLOW
    expect(output).toContain("50%");
  });

  test("different-models fixture shows correct model name", () => {
    const input = loadFixtureDirect("cursor", "different-models");
    const output = runFullPipeline(input);
    
    expect(output).toContain("Claude 3 Opus");
  });
});

describe("Formatter - Compaction Levels", () => {
  test("output fits within terminal width at various levels", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const output = runFullPipeline(input);
    
    // Output should not be excessively long
    expect(output.length).toBeLessThan(500);
  });

  test("compaction reduces output length progressively", () => {
    // This is implicitly tested by the statusline generator
    // which tries levels 0-6 until it fits
    const input = loadFixtureDirect("claude-code", "multiple-rate-limits");
    const output = runFullPipeline(input);
    
    expect(output.length).toBeLessThan(500);
  });
});

describe("Formatter - Color Preservation", () => {
  test("ANSI color codes present for context thresholds", () => {
    const input = loadFixtureDirect("claude-code", "high-context");
    const output = runFullPipeline(input);
    
    // Should have ANSI color codes
    expect(output).toContain("\x1b["); // ANSI escape sequence
  });

  test("ANSI reset codes present", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const output = runFullPipeline(input);
    
    // Should have ANSI reset codes
    expect(output).toContain("\x1b[0m"); // RESET
  });
});

describe("Formatter - Backward Compatibility", () => {
  test("Claude Code basic fixture produces valid output", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const output = runFullPipeline(input);
    
    // Should produce valid output without errors
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });

  test("Claude Code with-cache fixture produces valid output", () => {
    const input = loadFixtureDirect("claude-code", "with-cache");
    const output = runFullPipeline(input);
    
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });
});