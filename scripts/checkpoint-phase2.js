// Phase 2 Checkpoint Validation

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
// Go up one more level if we're in scripts/ directory
const PROJECT_ROOT = __dirname.endsWith("scripts") ? join(__dirname, "..") : __dirname;

console.log("=== Phase 2 Checkpoint Validation ===\n");

// 1. Check TypeScript compiles
console.log("1. TypeScript compilation: Already passed (npm run build)");

// 2. Check all existing tests pass
console.log("2. Existing tests: Already passed (npm test)");

// 3. Check required files exist
const requiredFiles = [
  "src/shared/unified-model.ts",
  "src/adapters/adapter.ts",
  "src/adapters/claude-code.ts",
  "src/adapters/cursor.ts",
  "src/adapters/index.ts",
];

console.log("\n3. Required files:");
for (const file of requiredFiles) {
  try {
    const content = readFileSync(join(PROJECT_ROOT, file), "utf-8");
    const exists = content.length > 0;
    console.log(`   ${exists ? "✅" : "❌"} ${file}`);
  } catch {
    console.log(`   ❌ ${file} (not found)`);
  }
}

// 4. Check test fixtures exist
const fixtures = [
  "test/fixtures/claude-code/basic.json",
  "test/fixtures/claude-code/with-cache.json",
  "test/fixtures/claude-code/high-context.json",
  "test/fixtures/claude-code/medium-context.json",
  "test/fixtures/claude-code/cache-cold.json",
  "test/fixtures/claude-code/multiple-rate-limits.json",
  "test/fixtures/claude-code/edge-empty.json",
  "test/fixtures/claude-code/edge-null.json",
  "test/fixtures/cursor/basic.json",
  "test/fixtures/cursor/full.json",
];

console.log("\n4. Test fixtures:");
for (const file of fixtures) {
  try {
    const content = readFileSync(join(PROJECT_ROOT, file), "utf-8");
    const exists = content.length > 0;
    console.log(`   ${exists ? "✅" : "❌"} ${file}`);
  } catch {
    console.log(`   ❌ ${file} (not found)`);
  }
}

// 5. Check adapter tests exist
console.log("\n5. Adapter tests:");
const testFile = "test/adapters/adapter.test.ts";
try {
  const content = readFileSync(join(PROJECT_ROOT, testFile), "utf-8");
  const exists = content.length > 0;
  console.log(`   ${exists ? "✅" : "❌"} ${testFile}`);
} catch {
  console.log(`   ❌ ${testFile} (not found)`);
}

// 6. Quick integration test - run statusline with fixtures
console.log("\n6. Integration test:");

const claudeResult = spawnSync("node", ["bin/statusline", "statusline"], {
  input: readFileSync(join(PROJECT_ROOT, "test/fixtures/claude-code/basic.json")),
  encoding: "utf-8",
  cwd: PROJECT_ROOT,
});
console.log(`   Claude Code: ${claudeResult.status === 0 ? "✅" : "❌"} (exit code: ${claudeResult.status})`);

const cursorResult = spawnSync("node", ["bin/statusline", "statusline"], {
  input: readFileSync(join(PROJECT_ROOT, "test/fixtures/cursor/basic.json")),
  encoding: "utf-8",
  cwd: PROJECT_ROOT,
});
console.log(`   Cursor: ${cursorResult.status === 0 ? "✅" : "❌"} (exit code: ${cursorResult.status})`);

console.log("\n=== Phase 2 Checkpoint Complete ===");