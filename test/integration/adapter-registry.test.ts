// Integration tests for adapter registry auto-detection

import { test, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { adapterRegistry, StatusLineAdapter } from "../../src/adapters/index.js";
import { AgentType } from "../../src/shared/unified-model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..", "..");

function loadFixtureDirect(agent: AgentType, name: string): unknown {
  const fixturePath = join(__dirname, "fixtures", agent, `${name}.json`);
  const content = readFileSync(fixturePath, "utf-8");
  return JSON.parse(content);
}

describe("Adapter Registry Auto-Detection", () => {
  test("detects Claude Code from basic fixture", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const adapter = adapterRegistry.detect(input);
    expect(adapter).toBeDefined();
    expect(adapter!.agentType).toBe("claude-code");
  });

  test("detects a fresh Cursor CLI session (no param_summary, null context fields)", () => {
    const input = loadFixtureDirect("cursor", "cli-fresh-session");
    const adapter = adapterRegistry.detect(input);
    expect(adapter).toBeDefined();
    expect(adapter!.agentType).toBe("cursor");
    expect(() => adapter!.parse(input as never)).not.toThrow();
  });

  test("detects Cursor from basic fixture", () => {
    const input = loadFixtureDirect("cursor", "basic");
    const adapter = adapterRegistry.detect(input);
    expect(adapter).toBeDefined();
    expect(adapter!.agentType).toBe("cursor");
  });

  test("priority: Cursor checked before Claude Code", () => {
    // Cursor has more specific detection fields
    const cursorInput = loadFixtureDirect("cursor", "basic");
    const adapter = adapterRegistry.detect(cursorInput);
    expect(adapter!.agentType).toBe("cursor");
  });

  test("getAgentTypes returns all registered types", () => {
    const types = adapterRegistry.getAgentTypes();
    expect(types).toContain("claude-code");
    expect(types).toContain("cursor");
    expect(types.length).toBe(2);
  });

  test("get returns correct adapter by type", () => {
    const claudeAdapter = adapterRegistry.get("claude-code");
    const cursorAdapter = adapterRegistry.get("cursor");
    
    expect(claudeAdapter).toBeDefined();
    expect(claudeAdapter!.agentType).toBe("claude-code");
    
    expect(cursorAdapter).toBeDefined();
    expect(cursorAdapter!.agentType).toBe("cursor");
  });

  test("get returns undefined for unknown type", () => {
    const adapter = adapterRegistry.get("unknown" as AgentType);
    expect(adapter).toBeUndefined();
  });

  test("getAll returns all registered adapters", () => {
    const adapters = adapterRegistry.getAll();
    expect(adapters.length).toBe(2);
    expect(adapters.map(a => a.agentType)).toEqual(["cursor", "claude-code"]);
  });

  test("parse with explicit agent type works", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const unified = adapterRegistry.parse(input, "claude-code");
    expect(unified.agent).toBe("claude-code");
  });

  test("parse without agent type auto-detects", () => {
    const input = loadFixtureDirect("cursor", "basic");
    const unified = adapterRegistry.parse(input);
    expect(unified.agent).toBe("cursor");
  });

  test("parse throws for unknown agent type", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    expect(() => adapterRegistry.parse(input, "unknown" as AgentType)).toThrow("Unknown agent type");
  });

  test("canHandle correctly identifies each agent", () => {
    const claudeAdapter = adapterRegistry.get("claude-code")!;
    const cursorAdapter = adapterRegistry.get("cursor")!;
    
    const claudeInput = loadFixtureDirect("claude-code", "basic");
    const cursorInput = loadFixtureDirect("cursor", "basic");
    
    expect(claudeAdapter.canHandle(claudeInput)).toBe(true);
    expect(claudeAdapter.canHandle(cursorInput)).toBe(false);
    
    expect(cursorAdapter.canHandle(cursorInput)).toBe(true);
    expect(cursorAdapter.canHandle(claudeInput)).toBe(false);
  });

  test("all fixtures can be parsed", () => {
    const claudeFixtures = ["basic", "with-cache", "high-context", "medium-context", "cache-cold", "multiple-rate-limits", "edge-empty", "edge-null"];
    const cursorFixtures = ["basic", "full", "high-context", "medium-context", "edge-empty", "edge-null", "different-models"];
    
    for (const name of claudeFixtures) {
      const input = loadFixtureDirect("claude-code", name);
      const unified = adapterRegistry.parse(input, "claude-code");
      expect(unified.agent).toBe("claude-code");
      expect(unified.sessionId).toBeDefined();
    }
    
    for (const name of cursorFixtures) {
      const input = loadFixtureDirect("cursor", name);
      const unified = adapterRegistry.parse(input, "cursor");
      expect(unified.agent).toBe("cursor");
      expect(unified.sessionId).toBeDefined();
    }
  });

  test("detect returns undefined for completely unknown input", () => {
    const unknownInput = { random: "data" };
    const adapter = adapterRegistry.detect(unknownInput);
    expect(adapter).toBeUndefined();
  });

  test("detect returns undefined for null input", () => {
    const adapter = adapterRegistry.detect(null);
    expect(adapter).toBeUndefined();
  });

  test("detect returns undefined for non-object input", () => {
    const adapter = adapterRegistry.detect("not an object");
    expect(adapter).toBeUndefined();
  });
});

describe("Adapter Interface Compliance", () => {
  test("all adapters implement required methods", () => {
    const adapters = adapterRegistry.getAll();
    
    for (const adapter of adapters) {
      expect(adapter.agentType).toBeDefined();
      expect(typeof adapter.parse).toBe("function");
      expect(typeof adapter.canHandle).toBe("function");
      // formatOutput is optional
    }
  });

  test("parse returns valid UnifiedStatusInput", () => {
    const adapters = adapterRegistry.getAll();
    
    for (const adapter of adapters) {
      // Test with a basic fixture for each agent
      const fixtureName = adapter.agentType === "claude-code" ? "basic" : "basic";
      const input = loadFixtureDirect(adapter.agentType, fixtureName);
      
      const unified = adapter.parse(input);
      
      // Validate unified model structure
      expect(unified.agent).toBe(adapter.agentType);
      expect(typeof unified.sessionId).toBe("string");
      expect(typeof unified.timestamp).toBe("number");
      expect(unified.model).toBeDefined();
      expect(unified.model.id).toBeDefined();
      expect(unified.model.displayName).toBeDefined();
      expect(unified.model.provider).toBeDefined();
      expect(unified.context).toBeDefined();
      expect(typeof unified.context.usedTokens).toBe("number");
      expect(typeof unified.context.maxTokens).toBe("number");
      expect(unified.usage).toBeDefined();
      expect(typeof unified.usage.inputTokens).toBe("number");
      expect(typeof unified.usage.outputTokens).toBe("number");
      expect(unified.cost).toBeDefined();
      expect(unified.cost.currency).toBe("USD");
      expect(unified.cache).toBeDefined();
      expect(Array.isArray(unified.rateLimits)).toBe(true);
      expect(unified.extensions).toBeDefined();
    }
  });
});