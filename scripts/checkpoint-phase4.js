// Phase 4 Checkpoint Validation

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const PROJECT_ROOT = __dirname.endsWith("scripts") ? join(__dirname, "..") : __dirname;

console.log("=== Phase 4 Checkpoint Validation ===\n");

let allPassed = true;

// 1. Check new Cursor fixtures exist
const cursorFixtures = [
  "test/fixtures/cursor/basic.json",
  "test/fixtures/cursor/full.json",
  "test/fixtures/cursor/high-context.json",
  "test/fixtures/cursor/medium-context.json",
  "test/fixtures/cursor/edge-empty.json",
  "test/fixtures/cursor/edge-null.json",
  "test/fixtures/cursor/different-models.json",
];

console.log("1. Cursor test fixtures:");
for (const file of cursorFixtures) {
  try {
    const content = readFileSync(join(PROJECT_ROOT, file), "utf-8");
    const exists = content.length > 0;
    console.log(`   ${exists ? "✅" : "❌"} ${file}`);
    if (!exists) allPassed = false;
  } catch {
    console.log(`   ❌ ${file} (not found)`);
    allPassed = false;
  }
}

// 2. Check integration test files exist
const integrationTests = [
  "test/integration/formatter.test.ts",
  "test/integration/adapter-registry.test.ts",
  "test/integration/end-to-end.test.ts",
];

console.log("\n2. Integration test files:");
for (const file of integrationTests) {
  try {
    const content = readFileSync(join(PROJECT_ROOT, file), "utf-8");
    const exists = content.length > 0;
    console.log(`   ${exists ? "✅" : "❌"} ${file}`);
    if (!exists) allPassed = false;
  } catch {
    console.log(`   ❌ ${file} (not found)`);
    allPassed = false;
  }
}

// 3. Run all tests
console.log("\n3. Running all tests:");
const testResult = spawnSync("npm", ["test"], {
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
  timeout: 120000,
});

const testsPassed = testResult.status === 0;
console.log(`   ${testsPassed ? "✅" : "❌"} All tests pass (exit code: ${testResult.status})`);
if (!testsPassed) {
  console.log("   Test output:");
  console.log(testResult.stdout);
  console.log(testResult.stderr);
  allPassed = false;
}

// 4. Check test coverage for adapters and formatter
console.log("\n4. Test coverage check:");
const coverageResult = spawnSync("npm", ["test", "--", "--coverage"], {
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
  timeout: 120000,
});

if (coverageResult.status === 0) {
  // Parse coverage output
  const output = coverageResult.stdout;
  const adapterCoverage = output.match(/adapters.*?(\d+\.?\d*)%/);
  const formatterCoverage = output.match(/formatter.*?(\d+\.?\d*)%/);
  
  if (adapterCoverage) {
    const pct = parseFloat(adapterCoverage[1]);
    console.log(`   ${pct >= 90 ? "✅" : "❌"} Adapter coverage: ${pct}% (need ≥90%)`);
    if (pct < 90) allPassed = false;
  }
  if (formatterCoverage) {
    const pct = parseFloat(formatterCoverage[1]);
    console.log(`   ${pct >= 80 ? "✅" : "❌"} Formatter coverage: ${pct}% (need ≥80%)`);
    if (pct < 80) allPassed = false;
  }
} else {
  console.log("   ⚠️  Coverage check skipped (command failed)");
}

console.log("\n=== Phase 4 Checkpoint Complete ===");
if (allPassed) {
  console.log("✅ Phase 4 checkpoint PASSED");
  process.exit(0);
} else {
  console.log("❌ Phase 4 checkpoint FAILED");
  process.exit(1);
}