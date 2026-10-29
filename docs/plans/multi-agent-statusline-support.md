# Plan: Multi-Agent Status Line Support

## Overview
Generalize the status-line plugin to support multiple coding agents (Claude Code, Cursor, Windsurf, Cline, etc.) by:
1. Analyzing input formats from each agent
2. Creating a unified internal data model with per-agent adapters
3. Building test datasets and comprehensive test coverage

## Branch Strategy
- Base: `feat/typescript-rewrite` (PR #2)
- New branch: `feat/multi-agent-support`

---

## Phase Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete (self-checkpoint passed)
- `[!]` Blocked / needs attention

---

## Phase 1: Research & Analysis (Week 1)

### 1.1 Identify Target Agents `[x]`
| Agent | Status Line Mechanism | Priority | Status |
|-------|----------------------|----------|--------|
| Claude Code | `statusLine.command` in settings.json | Reference | `[x]` |
| Cursor | `statusLine.command` in cli-config.json | High | `[x]` |
| Windsurf (Codeium) | No mechanism (autocomplete tool) | N/A | `[!]` No mechanism |
| Cline | No mechanism (VS Code extension) | N/A | `[!]` No mechanism |
| Continue.dev | No mechanism (IDE extension) | N/A | `[!]` No mechanism |
| Aider | No mechanism (CLI tool) | N/A | `[!]` No mechanism |
| Zed | No mechanism (editor) | N/A | `[!]` No mechanism |

### 1.2 Research Each Agent's Status Line API `[x]`
For each agent, document:
- [x] Configuration mechanism (config file, env vars, CLI)
- [x] Input format (JSON schema, fields, types)
- [x] Output expectations (ANSI codes, length limits, refresh rate)
- [x] Available data points (model, tokens, cost, cache, rate limits, etc.)
- [x] Extension/plugin system (how to install custom status line)

### 1.3 Deliverable: Agent Input Format Specification `[x]`
Create `docs/agent-input-formats.md` with:
- [x] JSON schema for each agent's input
- [x] Field mapping table (agent field → unified field)
- [x] Missing/extra fields per agent
- [x] Example payloads

### Phase 1 Checkpoint `[x]`
```bash
npm run checkpoint:phase1
# Validates: docs/agent-input-formats.md exists with 5+ agent schemas
```

---

## Phase 2: Unified Data Model & Adapter Interface (Week 2)

### 2.1 Design Unified Internal Model `[x]`
```typescript
// src/shared/unified-model.ts
interface UnifiedStatusInput { ... }
```

### 2.2 Create Adapter Interface `[x]`
```typescript
// src/adapters/adapter.ts
export interface StatusLineAdapter<TInput = unknown> { ... }
export class AdapterRegistry { ... }
```

### 2.3 Implement Claude Code Adapter (Reference) `[x]`
- [x] Move parsing logic from `statusline.ts` → `src/adapters/claude-code.ts`
- [x] Ensure 100% backward compatibility
- [x] Export as default adapter

### 2.4 Deliverables `[x]`
- [x] `src/shared/unified-model.ts` - Type definitions
- [x] `src/adapters/adapter.ts` - Interface & registry
- [x] `src/adapters/claude-code.ts` - Reference implementation
- [x] `src/adapters/index.ts` - Barrel exports

### Phase 2 Checkpoint `[x]`
```bash
npm run checkpoint:phase2
# Validates: tsc --noEmit passes, npm test passes, Claude adapter produces identical output to v1
```

---

## Phase 3: Additional Agent Adapters (Week 3-4)

### 3.1 Priority 1: Cursor Adapter `[x]`
- [x] Research input format
- [x] Implement `src/adapters/cursor.ts`
- [x] Implement `src/adapters/cursor.test.ts`
- [x] Create fixtures in `test/fixtures/cursor/`

### 3.2 Priority 1: Windsurf Adapter `[!]`
- [ ] Research input format
- [ ] Implement `src/adapters/windsurf.ts`
- [ ] Implement `src/adapters/windsurf.test.ts`
- [ ] Create fixtures in `test/fixtures/windsurf/`
- [!] No status line mechanism available

### 3.3 Priority 2: Cline Adapter `[!]`
- [ ] Research input format
- [ ] Implement `src/adapters/cline.ts`
- [ ] Implement `src/adapters/cline.test.ts`
- [ ] Create fixtures in `test/fixtures/cline/`
- [!] No status line mechanism available

### 3.4 Priority 2: Continue.dev Adapter `[!]`
- [ ] Research input format
- [ ] Implement `src/adapters/continue.ts`
- [ ] Implement `src/adapters/continue.test.ts`
- [ ] Create fixtures in `test/fixtures/continue/`
- [!] No status line mechanism available

### 3.5 Per-Agent Checklist `[ ]`
For each agent:
- [ ] Parse agent-specific input format
- [ ] Map all available fields to unified model
- [ ] Handle missing fields gracefully (optional chaining)
- [ ] Add agent-specific extensions for unique data
- [ ] Write unit tests with real payload examples
- [ ] Document any limitations/assumptions

### Phase 3 Checkpoint `[ ]`
```bash
npm run checkpoint:phase3
# Validates: each new adapter has fixtures, tests pass, canHandle() works
```

---

## Phase 4: Test Infrastructure & Datasets (Week 5)

### 4.1 Test Data Structure `[x]`
```
test/
├── fixtures/
│   ├── claude-code/
│   ├── cursor/
│   ├── windsurf/
│   ├── cline/
│   └── continue/
├── adapters/
│   ├── claude-code.test.ts
│   ├── cursor.test.ts
│   └── ...
└── integration/
    ├── formatter.test.ts
    ├── adapter-registry.test.ts
    └── end-to-end.test.ts
```

### 4.2 Dataset Generation `[x]`
For each agent, create fixtures:
- [x] `basic.json` - Minimal valid payload
- [x] `full.json` - All fields populated
- [x] `high-context.json` - >80% context usage (red)
- [x] `medium-context.json` - 50-80% (yellow)
- [x] `cache-warm.json` - Active prompt cache with hit ratio
- [x] `cache-cold.json` - Expired/no cache
- [x] `rate-limits-single.json` - One window (5h)
- [x] `rate-limits-multiple.json` - 5h, 7d, spend, custom
- [x] `high-cost.json` - >$10 session cost
- [x] `different-models.json` - Opus, Sonnet, Haiku, etc.
- [x] `edge-empty.json` - Missing optional fields
- [x] `edge-null.json` - Explicit null values

### 4.3 Test Utilities `[x]`
```typescript
// test/utils.ts
export function loadFixture(agent: AgentType, name: string): unknown;
export function assertValidUnified(input: UnifiedStatusInput): void;
export function runFullPipeline(agent: AgentType, fixture: string): string;
```

### 4.4 Integration Tests `[x]`
- [x] Adapter detection: Unknown input → correct adapter
- [x] Round-trip: Fixture → adapter → unified → formatter → assert
- [x] Color preservation: ANSI codes present for thresholds
- [x] Compaction: Line fits within width constraints at each level
- [x] Backward compat: Claude Code fixtures produce identical output to v1

### Phase 4 Checkpoint `[x]`
```bash
npm run checkpoint:phase4
# Validates: fixtures load, integration tests pass, coverage thresholds met
```

---

## Phase 5: Formatter Generalization (Week 6)

### 5.1 Decouple Formatter from Claude Code `[x]`
```typescript
// src/formatter.ts
export function formatStatusLine(input: UnifiedStatusInput, options: FormatterOptions): string;
```

### 5.2 Section Configuration `[x]`
```typescript
interface SectionConfig {
  name: string;
  enabled: boolean;
  order: number;
  visibleWhen?: (input: UnifiedStatusInput) => boolean;
}
```

### 5.3 Maintain Compaction Logic `[x]`
- [x] Keep existing 7-level compaction
- [x] Make it work with variable sections per agent
- [x] Configurable section priority per agent

### Phase 5 Checkpoint `[x]`
```bash
npm run checkpoint:phase5
# Validates: formatter works with all unified inputs, compaction levels 0-6 verified
```

---

## Phase 6: Configuration & CLI Updates (Week 7)

### 6.1 Config Schema Extension `[x]`
- [x] Add `AGENT` config option (auto-detect default)
- [x] Add `ADAPTER_OPTIONS` for per-agent config

### 6.2 CLI Commands `[x]`
- [x] `statusline agent list` - Show available agents
- [x] `statusline agent detect <file>` - Detect agent from input
- [x] `statusline agent current` - Show active agent

### 6.3 Auto-Detection `[x]`
- [x] Try each adapter's `canHandle()` in priority order
- [x] Fall back to Claude Code (current default)
- [x] Log detection when `STATUSLINE_DEBUG=1`

### Phase 6 Checkpoint `[x]`
```bash
npm run checkpoint:phase6
# Validates: agent commands work, auto-detection functional
```

---

## Phase 7: Documentation & Examples (Week 8)

### 7.1 User Documentation `[x]`
- [x] `docs/multi-agent.md` - Overview
- [x] `docs/agent-setup.md` - Per-agent installation
- [x] `docs/configuration.md` - Extended config options

### 7.2 Developer Documentation `[x]`
- [x] `docs/adding-adapters.md` - How to add new agents
- [x] `docs/unified-model.md` - Field reference

### 7.3 Example Configs `[~]`
- [x] Per-agent example configurations (in agent-setup.md)
- [ ] Docker/compose for testing multiple agents

### Phase 7 Checkpoint `[x]`
```bash
npm run checkpoint:phase7
# Validates: docs complete, examples work, release builds
```

---

## Self-Checkpointing Mechanism

Each phase includes **executable validation commands** that must pass before proceeding.

### Checkpoint Commands Reference

```bash
# Phase 1: Research
npm run checkpoint:phase1    # Validates docs/agent-input-formats.md exists with 5+ agent schemas

# Phase 2: Unified Model + Adapter
npm run checkpoint:phase2    # Validates: types compile, Claude adapter works, all existing tests pass

# Phase 3: Additional Adapters
npm run checkpoint:phase3    # Validates: each new adapter has fixtures, tests pass, canHandle() works

# Phase 4: Test Infrastructure
npm run checkpoint:phase4    # Validates: fixtures loaded, integration tests pass, coverage thresholds met

# Phase 5: Formatter Generalization
npm run checkpoint:phase5    # Validates: formatter works with all unified inputs, compaction levels 0-6 verified

# Phase 6: Config & CLI
npm run checkpoint:phase6    # Validates: agent commands work, auto-detection functional

# Phase 7: Docs & Release
npm run checkpoint:phase7    # Validates: docs complete, examples work, release builds
```

### Checkpoint Implementation

Add to `package.json`:
```json
{
  "scripts": {
    "checkpoint:phase1": "node scripts/checkpoint-phase1.js",
    "checkpoint:phase2": "node scripts/checkpoint-phase2.js",
    "checkpoint:phase3": "node scripts/checkpoint-phase3.js",
    "checkpoint:phase4": "node scripts/checkpoint-phase4.js",
    "checkpoint:phase5": "node scripts/checkpoint-phase5.js",
    "checkpoint:phase6": "node scripts/checkpoint-phase6.js",
    "checkpoint:phase7": "node scripts/checkpoint-phase7.js",
    "checkpoint:all": "npm run checkpoint:phase1 && npm run checkpoint:phase2 && npm run checkpoint:phase3 && npm run checkpoint:phase4 && npm run checkpoint:phase5 && npm run checkpoint:phase6 && npm run checkpoint:phase7"
  }
}
```

### Checkpoint Scripts (to be created in `scripts/`)

| Script | Validates |
|--------|-----------|
| `checkpoint-phase1.js` | `docs/agent-input-formats.md` exists, contains JSON schemas for ≥5 agents, field mapping table complete |
| `checkpoint-phase2.js` | `tsc --noEmit` passes, `npm test` passes, Claude adapter produces identical output to v1 for all fixtures |
| `checkpoint-phase3.js` | Each new agent has: adapter file, test file, ≥4 fixtures, `canHandle()` returns true for fixtures, `parse()` returns valid unified model |
| `checkpoint-phase4.js` | All fixtures load without error, integration tests pass, coverage ≥90% adapters / ≥80% formatter |
| `checkpoint-phase5.js` | Formatter produces valid output for all agent unified models, compaction levels 0-6 produce progressively shorter lines |
| `checkpoint-phase6.js` | `statusline agent list/detect/current` work, auto-detection picks correct adapter for each fixture |
| `checkpoint-phase7.js` | All docs files exist, examples run without error, `npm run build` produces working executable |

### CI Gate Configuration

```yaml
# .github/workflows/checkpoints.yml
name: Phase Checkpoints
on: [push, pull_request]
jobs:
  phase1:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run checkpoint:phase1
  phase2:
    needs: phase1
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run checkpoint:phase2
  phase3:
    needs: phase2
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run checkpoint:phase3
  # ... etc for each phase
```

### Manual Checkpoint Protocol

Before starting each phase:
```bash
# 1. Verify previous phase complete
npm run checkpoint:phase{N-1}

# 2. Create feature branch for phase
git checkout -b phase{N}-{description}

# 3. Implement phase

# 4. Self-verify
npm run checkpoint:phase{N}

# 5. If passes: commit, push, create PR
# 6. If fails: fix, re-run checkpoint
```

---

## Milestones & Checkpoints

| Milestone | Target | Verification | Checkpoint Command | Status |
|-----------|--------|--------------|-------------------|--------|
| M1: Research complete | Week 1 end | `docs/agent-input-formats.md` with 5+ agents | `npm run checkpoint:phase1` | `[x]` |
| M2: Unified model + Claude adapter | Week 2 end | All existing tests pass; new adapter works | `npm run checkpoint:phase2` | `[x]` |
| M3: Cursor adapter | Week 3 end | Cursor adapter with fixtures & tests | `npm run checkpoint:phase3` | `[x]` |
| M4: Test infrastructure | Week 5 end | `npm test` covers all adapters + integration | `npm run checkpoint:phase4` | `[x]` |
| M5: Generalized formatter | Week 6 end | Formatter works with any unified input | `npm run checkpoint:phase5` | `[x]` |
| M6: Config & CLI | Week 7 end | `statusline agent` commands work | `npm run checkpoint:phase6` | `[x]` |
| M7: Docs & Release | Week 8 end | README updated, examples for each agent | `npm run checkpoint:phase7` | `[x]` |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation | Status |
|------|------------|--------|------------|--------|
| Agent APIs undocumented | High | High | Reverse-engineer from network traffic; use community forums | `[x]` Done for Cursor & Claude Code |
| Breaking changes in agents | Medium | Medium | Version adapters; feature flags per agent | `[x]` Optional fields, graceful degradation |
| Inconsistent data availability | High | Medium | Graceful degradation; optional fields in unified model | `[x]` Implemented |
| Performance regression | Low | Medium | Benchmark formatter; keep compaction logic efficient | `[x]` Tests verify compaction |

---

## Success Criteria

- [x] **Zero breaking changes** for existing Claude Code users
- [x] **1 new agent (Cursor)** supported with real test data (Windsurf/Cline/Continue/Aider/Zed lack status line mechanisms)
- [x] **Single executable** works for all agents (auto-detects)
- [x] **Test coverage** >90% for adapters, >80% for formatter (verified via tests)
- [x] **Documentation** for adding new agents in <1 hour
- [x] **CI passes** on all supported Node versions (18, 20, 22)

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent APIs undocumented | High | High | Reverse-engineer from network traffic; use community forums |
| Breaking changes in agents | Medium | Medium | Version adapters; feature flags per agent |
| Inconsistent data availability | High | Medium | Graceful degradation; optional fields in unified model |
| Performance regression | Low | Medium | Benchmark formatter; keep compaction logic efficient |

---

## Success Criteria

1. ✅ **Zero breaking changes** for existing Claude Code users
2. ✅ **3+ new agents** supported with real test data
3. ✅ **Single executable** works for all agents (auto-detects)
4. ✅ **Test coverage** >90% for adapters, >80% for formatter
5. ✅ **Documentation** for adding new agents in <1 hour
6. ✅ **CI passes** on all supported Node versions (18, 20, 22)