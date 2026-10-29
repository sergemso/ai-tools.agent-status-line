// Phase 6 Checkpoint Validation

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const PROJECT_ROOT = __dirname.endsWith("scripts") ? join(__dirname, "..") : __dirname;
const BIN_PATH = join(PROJECT_ROOT, "bin/statusline");

console.log("=== Phase 6 Checkpoint Validation ===\n");

let allPassed = true;

// 1. Check CLI has agent command
console.log("1. CLI agent commands:");
const indexFile = "src/index.ts";
try {
  const content = readFileSync(join(PROJECT_ROOT, indexFile), "utf-8");
  const hasAgentCase = content.includes('case "agent"');
  const hasRunAgentCommand = content.includes("async function runAgentCommand");
  const hasAgentList = content.includes("case \"list\"");
  const hasAgentDetect = content.includes("case \"detect\"");
  const hasAgentCurrent = content.includes("case \"current\"");
  
  console.log(`   ${hasAgentCase ? "✅" : "❌"} Has agent case in main switch`);
  console.log(`   ${hasRunAgentCommand ? "✅" : "❌"} Has runAgentCommand function`);
  console.log(`   ${hasAgentList ? "✅" : "❌"} Has list subcommand`);
  console.log(`   ${hasAgentDetect ? "✅" : "❌"} Has detect subcommand`);
  console.log(`   ${hasAgentCurrent ? "✅" : "❌"} Has current subcommand`);
  
  if (!hasAgentCase || !hasRunAgentCommand || !hasAgentList || !hasAgentDetect || !hasAgentCurrent) {
    allPassed = false;
  }
} catch {
  console.log(`   ❌ ${indexFile} (not found)`);
  allPassed = false;
}

// 2. Test agent list command
console.log("\n2. Testing agent list command:");
const listResult = spawnSync("node", [BIN_PATH, "agent", "list"], {
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
});
const listPassed = listResult.status === 0 && listResult.stdout.includes("cursor") && listResult.stdout.includes("claude-code");
console.log(`   ${listPassed ? "✅" : "❌"} agent list works`);
if (!listPassed) {
  console.log(`   stdout: ${listResult.stdout}`);
  console.log(`   stderr: ${listResult.stderr}`);
  allPassed = false;
}

// 3. Test agent detect command
console.log("\n3. Testing agent detect command:");
const detectClaudeResult = spawnSync("node", [BIN_PATH, "agent", "detect", "test/fixtures/claude-code/basic.json"], {
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
});
const detectCursorResult = spawnSync("node", [BIN_PATH, "agent", "detect", "test/fixtures/cursor/basic.json"], {
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
});
const detectPassed = detectClaudeResult.status === 0 && detectClaudeResult.stdout.includes("claude-code") &&
                     detectCursorResult.status === 0 && detectCursorResult.stdout.includes("cursor");
console.log(`   ${detectPassed ? "✅" : "❌"} agent detect works for both agents`);
if (!detectPassed) {
  console.log(`   Claude: stdout=${detectClaudeResult.stdout}, stderr=${detectClaudeResult.stderr}`);
  console.log(`   Cursor: stdout=${detectCursorResult.stdout}, stderr=${detectCursorResult.stderr}`);
  allPassed = false;
}

// 4. Test agent current command
console.log("\n4. Testing agent current command:");
const currentResult = spawnSync("node", [BIN_PATH, "agent", "current"], {
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
});
const currentPassed = currentResult.status === 0 && currentResult.stdout.includes("claude-code");
console.log(`   ${currentPassed ? "✅" : "❌"} agent current works`);
if (!currentPassed) {
  console.log(`   stdout: ${currentResult.stdout}`);
  console.log(`   stderr: ${currentResult.stderr}`);
  allPassed = false;
}

// 5. Test auto-detection in statusline
console.log("\n5. Testing auto-detection in statusline:");
const claudeInput = readFileSync(join(PROJECT_ROOT, "test/fixtures/claude-code/basic.json"), "utf-8");
const cursorInput = readFileSync(join(PROJECT_ROOT, "test/fixtures/cursor/basic.json"), "utf-8");

const claudeStatusResult = spawnSync("node", [BIN_PATH, "statusline"], {
  input: claudeInput,
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
});
const cursorStatusResult = spawnSync("node", [BIN_PATH, "statusline"], {
  input: cursorInput,
  cwd: PROJECT_ROOT,
  encoding: "utf-8",
});

const autoDetectPassed = claudeStatusResult.status === 0 && claudeStatusResult.stdout.includes("Claude Sonnet 5.5") &&
                         cursorStatusResult.status === 0 && cursorStatusResult.stdout.includes("Claude 4 Opus");
console.log(`   ${autoDetectPassed ? "✅" : "❌"} Auto-detection works in statusline`);
if (!autoDetectPassed) {
  console.log(`   Claude: exit=${claudeStatusResult.status}, stdout=${claudeStatusResult.stdout}`);
  console.log(`   Cursor: exit=${cursorStatusResult.status}, stdout=${cursorStatusResult.stdout}`);
  allPassed = false;
}

// 6. Run all tests
console.log("\n6. Running all tests:");
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

console.log("\n=== Phase 6 Checkpoint Complete ===");
if (allPassed) {
  console.log("✅ Phase 6 checkpoint PASSED");
  process.exit(0);
} else {
  console.log("❌ Phase 6 checkpoint FAILED");
  process.exit(1);
}