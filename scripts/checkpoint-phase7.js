// Phase 7 Checkpoint Validation

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const PROJECT_ROOT = __dirname.endsWith("scripts") ? join(__dirname, "..") : __dirname;

console.log("=== Phase 7 Checkpoint Validation ===\n");

let allPassed = true;

// 1. Check documentation files exist
const docFiles = [
  "docs/multi-agent.md",
  "docs/agent-setup.md",
  "docs/configuration.md",
  "docs/adding-adapters.md",
  "docs/unified-model.md",
  "docs/agent-input-formats.md",
];

console.log("1. Documentation files:");
for (const file of docFiles) {
  try {
    const content = readFileSync(join(PROJECT_ROOT, file), "utf-8");
    const exists = content.length > 0;
    console.log(`   ${exists ? "✅" : "❌"} ${file} (${content.length} chars)`);
    if (!exists) allPassed = false;
  } catch {
    console.log(`   ❌ ${file} (not found)`);
    allPassed = false;
  }
}

// 2. Check key content in docs
console.log("\n2. Documentation content validation:");
try {
  const multiAgent = readFileSync(join(PROJECT_ROOT, "docs/multi-agent.md"), "utf-8");
  const hasOverview = multiAgent.includes("Overview");
  const hasArchitecture = multiAgent.includes("Architecture");
  const hasAgents = multiAgent.includes("Claude Code") && multiAgent.includes("Cursor");
  console.log(`   ${hasOverview ? "✅" : "❌"} multi-agent.md has overview`);
  console.log(`   ${hasArchitecture ? "✅" : "❌"} multi-agent.md has architecture`);
  console.log(`   ${hasAgents ? "✅" : "❌"} multi-agent.md lists agents`);
  if (!hasOverview || !hasArchitecture || !hasAgents) allPassed = false;
} catch {
  console.log("   ❌ multi-agent.md not found");
  allPassed = false;
}

try {
  const setup = readFileSync(join(PROJECT_ROOT, "docs/agent-setup.md"), "utf-8");
  const hasClaude = setup.includes("Claude Code");
  const hasCursor = setup.includes("Cursor");
  const hasInstall = setup.includes("Installation");
  console.log(`   ${hasClaude ? "✅" : "❌"} agent-setup.md covers Claude Code`);
  console.log(`   ${hasCursor ? "✅" : "❌"} agent-setup.md covers Cursor`);
  console.log(`   ${hasInstall ? "✅" : "❌"} agent-setup.md has installation steps`);
  if (!hasClaude || !hasCursor || !hasInstall) allPassed = false;
} catch {
  console.log("   ❌ agent-setup.md not found");
  allPassed = false;
}

try {
  const config = readFileSync(join(PROJECT_ROOT, "docs/configuration.md"), "utf-8");
  const hasSettings = config.includes("Settings Reference");
  const hasEnvVars = config.includes("Environment Variable");
  const hasCommands = config.includes("Configuration Commands");
  console.log(`   ${hasSettings ? "✅" : "❌"} configuration.md has settings reference`);
  console.log(`   ${hasEnvVars ? "✅" : "❌"} configuration.md has env vars`);
  console.log(`   ${hasCommands ? "✅" : "❌"} configuration.md has commands`);
  if (!hasSettings || !hasEnvVars || !hasCommands) allPassed = false;
} catch {
  console.log("   ❌ configuration.md not found");
  allPassed = false;
}

try {
  const adding = readFileSync(join(PROJECT_ROOT, "docs/adding-adapters.md"), "utf-8");
  const hasSteps = adding.includes("Step 1") && adding.includes("Step 2");
  const hasExample = adding.includes("Example: Minimal Adapter");
  console.log(`   ${hasSteps ? "✅" : "❌"} adding-adapters.md has steps`);
  console.log(`   ${hasExample ? "✅" : "❌"} adding-adapters.md has example`);
  if (!hasSteps || !hasExample) allPassed = false;
} catch {
  console.log("   ❌ adding-adapters.md not found");
  allPassed = false;
}

try {
  const unified = readFileSync(join(PROJECT_ROOT, "docs/unified-model.md"), "utf-8");
  const hasFields = unified.includes("Field Availability by Agent");
  const hasExamples = unified.includes("Example Unified Models");
  console.log(`   ${hasFields ? "✅" : "❌"} unified-model.md has field table`);
  console.log(`   ${hasExamples ? "✅" : "❌"} unified-model.md has examples`);
  if (!hasFields || !hasExamples) allPassed = false;
} catch {
  console.log("   ❌ unified-model.md not found");
  allPassed = false;
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

// 4. Build succeeds
console.log("\n4. Build verification:");
const buildResult = spawnSync("npm", ["run", "build"], {
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
  timeout: 60000,
});
const buildPassed = buildResult.status === 0;
console.log(`   ${buildPassed ? "✅" : "❌"} Build succeeds`);
if (!buildPassed) {
  console.log(`   stdout: ${buildResult.stdout}`);
  console.log(`   stderr: ${buildResult.stderr}`);
  allPassed = false;
}

// 5. Binary works
console.log("\n5. Binary execution:");
const binResult = spawnSync("node", ["bin/statusline", "statusline"], {
  input: readFileSync(join(PROJECT_ROOT, "test/fixtures/claude-code/basic.json"), "utf-8"),
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
});
const binPassed = binResult.status === 0 && binResult.stdout.length > 0;
console.log(`   ${binPassed ? "✅" : "❌"} Binary produces output`);
if (!binPassed) {
  console.log(`   exit: ${binResult.status}, stdout: ${binResult.stdout}, stderr: ${binResult.stderr}`);
  allPassed = false;
}

console.log("\n=== Phase 7 Checkpoint Complete ===");
if (allPassed) {
  console.log("✅ Phase 7 checkpoint PASSED");
  process.exit(0);
} else {
  console.log("❌ Phase 7 checkpoint FAILED");
  process.exit(1);
}