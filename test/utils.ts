// Test utilities for multi-agent testing

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { UnifiedStatusInput, AgentType } from "shared/unified-model.js";
import { adapterRegistry } from "adapters/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..", "..");

export function loadFixture(agent: AgentType, name: string): unknown {
  const fixturePath = join(__dirname, "fixtures", agent, `${name}.json`);
  const content = readFileSync(fixturePath, "utf-8");
  return JSON.parse(content);
}

export function assertValidUnified(input: UnifiedStatusInput): void {
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

export function runFullPipeline(agent: AgentType, fixtureName: string): string {
  const fixture = loadFixture(agent, fixtureName);
  const unified = adapterRegistry.parse(fixture);
  assertValidUnified(unified);
  
  // Note: This only tests parsing, not full formatting
  // Full formatting test would require importing generateStatusLine
  return JSON.stringify(unified, null, 2);
}

export function listFixtures(agent: AgentType): string[] {
  const fixturesDir = join(__dirname, "fixtures", agent);
  try {
    const files = readFileSync(fixturesDir, "utf-8");
    // This is a placeholder - in real implementation would use fs.readdirSync
    return [];
  } catch {
    return [];
  }
}