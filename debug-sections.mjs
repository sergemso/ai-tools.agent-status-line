#!/usr/bin/env node

import { readFileSync } from "fs";
import { adapterRegistry } from "./dist/adapters/index.js";
import { buildSectionsString } from "./dist/formatter.js";

// Test cache-cold fixture
const fixture = JSON.parse(readFileSync("test/fixtures/claude-code/cache-cold.json", "utf-8"));
const unified = adapterRegistry.parse(fixture);
console.log("=== Unified cache-cold ===");
console.log("cache:", JSON.stringify(unified.cache, null, 2));

const sections = buildSectionsString(unified.agent);
console.log("\n=== Sections string ===");
console.log(sections);

// Parse sections string like buildUserConfig does
const enabledSections = new Set(sections.split(",").map((s) => s.trim()));
console.log("\n=== Enabled sections ===");
console.log([...enabledSections]);

const sectionMap = {
  "model": "model",
  "context": "context",
  "tokens": "usage",
  "cost": "cost",
  "overhead": "overhead",
  "cache": "cache",
  "stats": "cache",
  "resets": "rate-limits",
  "vim": "vim",
  "worktree": "worktree",
  "cursor-extensions": "cursor-extensions",
};

const configSections = {};
for (const [legacyName, newId] of Object.entries(sectionMap)) {
  const isEnabled = enabledSections.has(legacyName);
  if (isEnabled || !(newId in configSections)) {
    configSections[newId] = { enabled: isEnabled };
  }
}

console.log("\n=== Config sections ===");
console.log(JSON.stringify(configSections, null, 2));