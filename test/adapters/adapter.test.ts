// Adapter tests

import { test, expect, describe, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..", "..");

// Import from built dist since path aliases don't work in test directory
import { adapterRegistry } from "../../dist/adapters/index.js";
import { UnifiedStatusInput, AgentType } from "../../dist/shared/unified-model.js";

function loadFixtureDirect(agent: AgentType, name: string): unknown {
  const fixturePath = join(__dirname, "fixtures", agent, `${name}.json`);
  const content = readFileSync(fixturePath, "utf-8");
  return JSON.parse(content);
}

function assertValidUnified(input: UnifiedStatusInput): void {
  // Core identification
  if (!input.agent || !["claude-code", "cursor"].includes(input.agent)) {
    throw new Error(`Invalid agent: ${input.agent}`);
  }
  if (!input.sessionId || typeof input.sessionId !== "string") {
    throw new Error("Missing or invalid sessionId");
  }
  if (!input.timestamp || typeof input.timestamp !== "number") {
    throw new Error("Missing or invalid timestamp");
  }
  
  // Model
  if (!input.model || typeof input.model !== "object") {
    throw new Error("Missing model");
  }
  if (!input.model.id || !input.model.displayName) {
    throw new Error("Missing model id or displayName");
  }
  if (!input.model.provider) {
    throw new Error("Missing model provider");
  }
  
  // Context
  if (!input.context || typeof input.context !== "object") {
    throw new Error("Missing context");
  }
  if (typeof input.context.usedTokens !== "number") {
    throw new Error("Missing context.usedTokens");
  }
  if (typeof input.context.maxTokens !== "number") {
    throw new Error("Missing context.maxTokens");
  }
  
  // Usage
  if (!input.usage || typeof input.usage !== "object") {
    throw new Error("Missing usage");
  }
  if (typeof input.usage.inputTokens !== "number") {
    throw new Error("Missing usage.inputTokens");
  }
  if (typeof input.usage.outputTokens !== "number") {
    throw new Error("Missing usage.outputTokens");
  }
  
  // Cost
  if (!input.cost || typeof input.cost !== "object") {
    throw new Error("Missing cost");
  }
  if (input.cost.sessionCostUsd !== null && typeof input.cost.sessionCostUsd !== "number") {
    throw new Error("Invalid cost.sessionCostUsd");
  }
  if (input.cost.currency !== "USD") {
    throw new Error("Invalid cost.currency");
  }
  
  // Cache
  if (!input.cache || typeof input.cache !== "object") {
    throw new Error("Missing cache");
  }
  
  // Rate limits
  if (!Array.isArray(input.rateLimits)) {
    throw new Error("Missing rateLimits array");
  }
  
  // Extensions
  if (!input.extensions || typeof input.extensions !== "object") {
    throw new Error("Missing extensions");
  }
}

describe("Claude Code Adapter", () => {
  const fixtures = ["basic", "with-cache", "high-context", "medium-context", "cache-cold", "multiple-rate-limits", "edge-empty", "edge-null"];
  
  for (const fixtureName of fixtures) {
    test(`parses ${fixtureName} fixture correctly`, () => {
      const input = loadFixtureDirect("claude-code", fixtureName);
      const unified = adapterRegistry.parse(input, "claude-code");
      
      expect(unified).toBeDefined();
      expect(unified.agent).toBe("claude-code");
      assertValidUnified(unified);
      
      // Check specific fields
      expect(unified.sessionId).toBeDefined();
      expect(unified.model.id).toBeDefined();
      expect(unified.model.displayName).toBeDefined();
      expect(unified.model.provider).toBe("anthropic");
      expect(typeof unified.context.usedTokens).toBe("number");
      expect(typeof unified.context.maxTokens).toBe("number");
      expect(unified.usage.inputTokens).toBeGreaterThanOrEqual(0);
      expect(unified.usage.outputTokens).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(unified.rateLimits)).toBe(true);
    });
  }
  
  test("canHandle detects Claude Code input", () => {
    const adapter = adapterRegistry.get("claude-code");
    expect(adapter).toBeDefined();
    
    const input = loadFixtureDirect("claude-code", "basic");
    expect(adapter!.canHandle(input)).toBe(true);
  });
  
  test("canHandle rejects Cursor input", () => {
    const adapter = adapterRegistry.get("claude-code");
    expect(adapter).toBeDefined();
    
    const input = loadFixtureDirect("cursor", "basic");
    expect(adapter!.canHandle(input)).toBe(false);
  });
});

describe("Cursor Adapter", () => {
  const fixtures = ["basic", "full"];
  
  for (const fixtureName of fixtures) {
    test(`parses ${fixtureName} fixture correctly`, () => {
      const input = loadFixtureDirect("cursor", fixtureName);
      const unified = adapterRegistry.parse(input, "cursor");
      
      expect(unified).toBeDefined();
      expect(unified.agent).toBe("cursor");
      assertValidUnified(unified);
      
      // Check Cursor-specific fields
      expect(unified.model.capabilities.paramSummary).toBeDefined();
      expect(unified.model.capabilities.maxMode).toBeDefined();
      expect(unified.extensions.renderWidthChars).toBeDefined();
      expect(unified.extensions.autorun).toBeDefined();
      expect(unified.extensions.vimMode).toBeDefined();
      
      // Cursor doesn't have cost/cache/rate limits
      expect(unified.cost.sessionCostUsd).toBeNull();
      expect(unified.cache.ttlSeconds).toBeNull();
      expect(unified.rateLimits).toHaveLength(0);
    });
  }
  
  test("canHandle detects Cursor input", () => {
    const adapter = adapterRegistry.get("cursor");
    expect(adapter).toBeDefined();
    
    const input = loadFixtureDirect("cursor", "basic");
    expect(adapter!.canHandle(input)).toBe(true);
  });
  
  test("canHandle rejects Claude Code input", () => {
    const adapter = adapterRegistry.get("cursor");
    expect(adapter).toBeDefined();
    
    const input = loadFixtureDirect("claude-code", "basic");
    expect(adapter!.canHandle(input)).toBe(false);
  });
});

describe("Adapter Registry Auto-Detection", () => {
  test("detects Claude Code from basic fixture", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const adapter = adapterRegistry.detect(input);
    expect(adapter).toBeDefined();
    expect(adapter!.agentType).toBe("claude-code");
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
});

describe("Unified Model Validation", () => {
  test("basic Claude Code fixture produces valid unified model", () => {
    const input = loadFixtureDirect("claude-code", "basic");
    const unified = adapterRegistry.parse(input);
    assertValidUnified(unified);
  });
  
  test("basic Cursor fixture produces valid unified model", () => {
    const input = loadFixtureDirect("cursor", "basic");
    const unified = adapterRegistry.parse(input);
    assertValidUnified(unified);
  });
  
  test("high-context fixture has correct usedPercentage", () => {
    const input = loadFixtureDirect("claude-code", "high-context");
    const unified = adapterRegistry.parse(input);
    expect(unified.context.usedPercentage).toBe(85.0);
    expect(unified.context.usedTokens).toBe(200000); // 170000 + 30000
  });
  
  test("cache-cold fixture has warm=false", () => {
    const input = loadFixtureDirect("claude-code", "cache-cold");
    const unified = adapterRegistry.parse(input);
    expect(unified.cache.warm).toBe(false);
    expect(unified.cache.ttlSeconds).toBe(3600);
  });
  
  test("multiple-rate-limits fixture has 4 rate limit windows", () => {
    const input = loadFixtureDirect("claude-code", "multiple-rate-limits");
    const unified = adapterRegistry.parse(input);
    expect(unified.rateLimits.length).toBe(4);
    
    const windowIds = unified.rateLimits.map(w => w.id);
    expect(windowIds).toContain("5h");
    expect(windowIds).toContain("7d");
    expect(windowIds).toContain("spend");
    expect(windowIds).toContain("1d");
  });
  
  test("edge-empty fixture handles null values gracefully", () => {
    const input = loadFixtureDirect("claude-code", "edge-empty");
    const unified = adapterRegistry.parse(input);
    expect(unified.context.usedPercentage).toBeNull();
    expect(unified.cache.ttlSeconds).toBeNull();
    expect(unified.cache.warm).toBe(false);
    expect(unified.rateLimits).toHaveLength(0);
  });
  
  test("edge-null fixture handles explicit null values", () => {
    const input = loadFixtureDirect("claude-code", "edge-null");
    const unified = adapterRegistry.parse(input);
    // The rate limit has null used_percentage, should be converted to null usedPercentage
    const fiveHour = unified.rateLimits.find(w => w.id === "5h");
    expect(fiveHour).toBeDefined();
    expect(fiveHour!.usedPercentage).toBeNull();
  });
});