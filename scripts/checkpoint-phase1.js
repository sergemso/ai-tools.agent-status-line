// Phase 1 Checkpoint Validation

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const PROJECT_ROOT = __dirname.endsWith("scripts") ? join(__dirname, "..") : __dirname;

console.log("=== Phase 1 Checkpoint Validation ===\n");

const docPath = join(PROJECT_ROOT, "docs/agent-input-formats.md");
try {
  const content = readFileSync(docPath, "utf-8");
  
  // Check for required sections
  const hasClaudeCode = content.includes("Claude Code");
  const hasCursor = content.includes("Cursor");
  const hasFieldMapping = content.includes("Field Mapping Table");
  const hasSchemas = content.includes("JSON Schema");
  const hasExamples = content.includes("Example Payloads");
  
  console.log("1. Agent input formats document:");
  console.log(`   ${hasClaudeCode ? "✅" : "❌"} Contains Claude Code section`);
  console.log(`   ${hasCursor ? "✅" : "❌"} Contains Cursor section`);
  console.log(`   ${hasFieldMapping ? "✅" : "❌"} Contains field mapping table`);
  console.log(`   ${hasSchemas ? "✅" : "❌"} Contains JSON schemas`);
  console.log(`   ${hasExamples ? "✅" : "❌"} Contains example payloads`);
  
  // Count agents with schemas
  const agentCount = (content.match(/interface \w+StatusInput/g) || []).length;
  console.log(`   Agents with schemas: ${agentCount} (need ≥2)`);
  
  if (hasClaudeCode && hasCursor && hasFieldMapping && hasSchemas && hasExamples && agentCount >= 2) {
    console.log("\n✅ Phase 1 checkpoint PASSED");
    process.exit(0);
  } else {
    console.log("\n❌ Phase 1 checkpoint FAILED");
    process.exit(1);
  }
} catch {
  console.log("❌ docs/agent-input-formats.md not found");
  process.exit(1);
}