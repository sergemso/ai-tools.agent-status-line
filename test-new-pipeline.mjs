#!/usr/bin/env node

import { readFileSync } from "fs";
import { buildLayout, getSections } from "./packages/core/dist/index.js";
import { cliRenderer } from "./packages/core/dist/index.js";
import { adapterRegistry } from "./dist/adapters/index.js";
import { loadPrices } from "./dist/shared/prices.js";
import { matchModelPrice } from "./dist/shared/prices.js";

// Load fixture
const fixture = JSON.parse(readFileSync("test/fixtures/claude-code/basic.json", "utf-8"));

console.log("=== Input ===");
console.log(JSON.stringify(fixture, null, 2));

// Parse using adapter registry
const unified = adapterRegistry.parse(fixture);
console.log("\n=== Unified ===");
console.log(JSON.stringify(unified, null, 2));

// Load prices for overhead calculation
const prices = await loadPrices("", 3600);

// Calculate overhead (ported from legacy formatter)
function calculateOverhead(unified, prices) {
  const { cache, model, extensions } = unified;
  const ctoks = cache.recacheTokensIfCold;
  const freshTokens = 25000; // DEFAULT_FRESH_TOKENS
  
  if (ctoks == null || cache.ttlSeconds == null || ctoks <= freshTokens) {
    return { show: false };
  }

  const modelPrices = prices.models[model.displayName] || 
    prices.models[`Claude ${model.displayName}`] || 
    prices.models[model.displayName.toLowerCase()] || 
    prices.models[`claude ${model.displayName.toLowerCase()}`];
    
  if (!modelPrices) {
    return { show: false };
  }

  const pin = extensions.fastMode === true && modelPrices.fast_in ? modelPrices.fast_in : modelPrices.in;
  const pout = modelPrices.out;
  const wmul = cache.ttlSeconds === 3600 ? 2 : 1.25;

  const d = ctoks - freshTokens;
  const oCall = (d * 0.1 * pin) / 1e6;
  const oCold = (d * wmul * pin) / 1e6;
  const oBe = freshTokens * wmul / (d * 0.1);
  const summaryTokens = 8000; // DEFAULT_SUMMARY_TOKENS
  const oCompact = (ctoks * 0.1 * pin + summaryTokens * pout + (freshTokens + summaryTokens) * wmul * pin) / 1e6;

  return {
    show: true,
    costPerCall: oCall,
    breakEven: Math.ceil(oBe) < 1 ? 1 : Math.ceil(oBe),
    compactCost: oCompact,
    isCold: !cache.warm,
    coldCost: oCold,
  };
}

const overhead = calculateOverhead(unified, prices);
console.log("\n=== Overhead ===");
console.log(JSON.stringify(overhead, null, 2));

// Adapt unified input for core sections
function adaptInputForCore(unified, overhead) {
  const { model, context, usage, cost, cache, rateLimits, vim, worktree, extensions } = unified;
  
  return {
    model: {
      name: model.displayName,
      effort: model.capabilities.effortLevel,
      costMultiplier: null, // Simplified
      id: model.id,
    },
    context: {
      percentage: context.usedPercentage,
      tokensUsed: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      tokensTotal: context.maxTokens,
    },
    cost: {
      session: cost.sessionCostUsd,
      total: cost.totalCostUsd,
    },
    cache: cache.ttlSeconds !== null ? {
      status: cache.warm ? "warm" : "cold",
      hitRatio: cache.hitRatio,
      expiresAt: cache.expiresAt,
    } : null,
    rateLimits: rateLimits.map((r) => ({
      window: r.id,
      limit: r.limit,
      remaining: r.limit !== null ? r.limit - (r.limit * (r.usedPercentage ?? 0) / 100) : 0,
      resetsAt: r.resetsAt,
    })),
    overhead,
    usage: {
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      cacheTokens: cache.recacheTokensIfCold,
    },
    vim: vim ? { mode: vim.mode } : null,
    worktree: worktree ? { name: worktree.name } : null,
    cursorExtensions: extensions ? {
      maxMode: extensions.maxMode,
      paramSummary: extensions.paramSummary,
      autorun: extensions.autorun,
    } : null,
  };
}

// Build user config matching legacy default sections
const userConfig = {
  sections: {
    model: { enabled: true },
    context: { enabled: true },
    cost: { enabled: true },
    overhead: { enabled: true },
    cache: { enabled: true },
    "rate-limits": { enabled: true },
    usage: { enabled: false },
    vim: { enabled: false },
    worktree: { enabled: false },
    "cursor-extensions": { enabled: false },
  },
  items: {},
  priorityThreshold: 0,
};

// Create render context
const adaptedInput = adaptInputForCore(unified, overhead);
const ctx = {
  input: adaptedInput,
  width: 120,
  target: "cli",
  config: userConfig,
};

// Get sections with config applied
const sections = getSections(userConfig, ctx);
console.log("\n=== Sections ===");
for (const s of sections) {
  console.log(`Section: ${s.id} (priority: ${s.priority})`);
  for (const item of s.items) {
    console.log(`  Item: ${item.id} (priority: ${item.priority})`);
  }
}

// Build layout
const layout = buildLayout(sections, ctx);
console.log("\n=== Layout ===");
console.log(`Total width: ${layout.meta.totalWidth}`);
console.log(`Available width: ${layout.meta.availableWidth}`);
console.log(`Overflow: ${layout.meta.overflow}`);
console.log(`Dropped items: ${layout.meta.droppedItems.length}`);
for (const s of layout.sections) {
  console.log(`Section: ${s.id}`);
  for (const item of s.items) {
    console.log(`  Item: ${item.id}`);
  }
}

// Render
const output = cliRenderer.render(layout, ctx);
console.log("\n=== Output ===");
console.log(output);
console.log("\n=== Output (raw) ===");
console.log(JSON.stringify(output));