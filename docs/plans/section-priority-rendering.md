# Plan: Section Priority-Based Rendering

## Overview
Refactor the status line rendering to use a **section → section items → priority-based shrinking** model:
1. **Sections** are logical groups (model, context, cost, cache, rate-limits, usage, vim, worktree)
2. **Section items** are atomic display units within a section (model.name, model.effort, model.costMultiplier)
3. **Priority levels** (0-100) control shrink order when width is constrained
4. **Target-agnostic layout** → agent-specific renderers (CLI, VS Code, Neovim, OpenCode)

---

## Phase Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

---

## Phase 1: Core Data Model & Types

### 1.1 Define Priority & Types `[x]`
```typescript
// packages/core/src/model.ts
type Priority = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;
interface SectionItem { id, content, priority, minWidth?, idealWidth?, visibleWhen?, hints? }
interface Section { id, name, priority, items: SectionItem[], visibleWhen?, minItems? }
interface SectionLayout { sections: Section[], meta: { totalWidth, availableWidth, overflow } }
interface RenderContext { input, width, target, config }
```

### 1.2 Content Types `[x]`
- `string` - static content
- `function(ctx: RenderContext): string` - dynamic content
- `{ template: string; values: Record<string, any>; fallback?: string }` - templated
- `{ parts: Array<{ text, style?, color? }> }` - rich content (future)

### 1.3 Deliverables
- `packages/core/src/model.ts` - All types
- `packages/core/src/priority.ts` - Priority constants & helpers
- `packages/core/src/index.ts` - Package exports
- `packages/core/package.json` - Package config
- `packages/core/tsconfig.json` - TypeScript config

---

## Phase 2: Built-in Sections

### 2.1 Section Definitions `[ ]`
Each section in `packages/core/src/sections/`:
| Section | Priority | Items (priority) |
|---------|----------|------------------|
| `model` | CRITICAL | name(CRITICAL), effort(MEDIUM), costMultiplier(LOW), id(NONE) |
| `context` | HIGH | bar(HIGH), tokens(MEDIUM), percentage(MEDIUM) |
| `cost` | HIGH | session(HIGH), total(LOW) |
| `cache` | MEDIUM | status(MEDIUM), hitRatio(LOW) |
| `rate-limits` | MEDIUM | each window(MEDIUM/HIGH based on %) |
| `usage` | MEDIUM | tokens(MEDIUM), cacheTokens(LOW) |
| `vim` | LOW | mode(LOW) |
| `worktree` | LOW | name(LOW) |
| `cursor-extensions` | LOW | maxMode(MEDIUM), paramSummary(LOW), autorun(LOW) |

### 2.2 Section Registry `[ ]`
```typescript
// packages/core/src/sections/index.ts
export const DEFAULT_SECTIONS: Section[] = [modelSection, contextSection, ...];
export function getSections(config: UserConfig): Section[]; // Applies user overrides
```

### 2.3 Deliverables
- `packages/core/src/sections/*.ts` - One file per section
- `packages/core/src/sections/index.ts` - Registry + config integration

---

## Phase 3: Layout Engine (Priority-Based Shrinking)

### 3.1 Core Algorithm `[ ]`
```typescript
// packages/core/src/layout.ts
export function buildLayout(sections: Section[], ctx: RenderContext): SectionLayout {
  // 1. Filter visible sections/items
  // 2. Compute composite priority: sectionPriority * 1000 + itemPriority
  // 3. Sort by composite priority desc
  // 4. Greedy fit: add items until width exhausted
  // 5. CRITICAL items evict lowest non-critical if needed
  // 6. Re-group by section, preserve section order
}
```

### 3.2 Width Estimation `[ ]`
- `estimateWidth(item, ctx)` - ANSI-stripped length + icon padding
- Account for separators (`" | "` = 3 chars)

### 3.3 Deliverables
- `packages/core/src/layout.ts` - Pure layout function
- `packages/core/src/layout.test.ts` - Comprehensive tests

### 3.4 Test Cases
| Width | Expected Kept (by priority) |
|-------|----------------------------|
| 120 | All items |
| 80 | Drop LOW/NONE items |
| 60 | Drop MEDIUM items |
| 40 | Keep only CRITICAL + HIGH |
| 25 | Only CRITICAL items |

---

## Phase 4: Renderer Interface & Implementations

### 4.1 Renderer Interface `[ ]`
```typescript
// packages/core/src/renderer.ts
interface Renderer<TOutput> {
  readonly target: RenderTarget;
  render(layout: SectionLayout, ctx: RenderContext): TOutput;
  measureItem(item: SectionItem, ctx: RenderContext): number;
  renderItem(item: SectionItem, ctx: RenderContext): TOutput;
  join(items: TOutput[], separator: TOutput): TOutput;
}
```

### 4.2 CLI Renderer (ANSI) `[ ]`
- `packages/core/src/renderers/cli.ts`
- Colorize using `colors.ts` scheme
- Separator: ` \u001b[2m|\u001b[0m ` (dim pipe)

### 4.3 VS Code Renderer `[ ]`
- `packages/core/src/renderers/vscode.ts`
- Returns `vscode.StatusBarItem` array
- No ANSI - uses VS Code theming

### 4.4 Neovim Renderer `[ ]`
- `packages/core/src/renderers/neovim.ts`
- Returns lualine-compatible component table
- Lua-compatible output

### 4.5 Deliverables
- `packages/core/src/renderer.ts` - Interface
- `packages/core/src/renderers/*.ts` - Implementations
- `packages/core/src/renderers/index.ts` - Factory `getRenderer(target)`

---

## Phase 5: Configuration Integration

### 5.1 User Config Schema `[ ]`
```json
{
  "sections": {
    "model": { "enabled": true, "priority": "CRITICAL" },
    "context": { "enabled": true, "priority": "HIGH" },
    "cache": { "enabled": false },
    "rate-limits": { "priority": "LOW" }
  },
  "items": {
    "model.effort": { "priority": "HIGH" },
    "model.costMultiplier": { "enabled": false }
  },
  "priorityThreshold": "LOW"
}
```

### 5.2 Config Application `[ ]`
```typescript
function applyConfig(sections: Section[], config: UserConfig): Section[] {
  // Enable/disable sections
  // Override section priority
  // Enable/disable items
  // Override item priority
  // Apply global priorityThreshold
}
```

### 5.3 Deliverables
- `packages/core/src/config.ts` - Config types + application logic
- Update `src/config.ts` (CLI) to use new schema

---

## Phase 6: CLI Integration

### 6.1 Refactor `src/formatter.ts` `[ ]`
- Replace current formatting with `buildLayout + cliRenderer`
- Maintain backward-compatible output for existing tests

### 6.2 Update Entry Point `[ ]`
- `src/index.ts` → use new pipeline
- `src/statusline.ts` → delegate to core

### 6.3 Deliverables
- Updated `src/formatter.ts`
- Updated `src/index.ts`
- All existing tests pass (byte-for-byte for Claude Code fixtures)

---

## Phase 7: Package Extraction (Core Library)

### 7.1 Create `@statusline/core` Package `[ ]`
```
packages/
├── core/                    # NEW: Pure TS, zero deps
│   ├── src/
│   │   ├── model.ts
│   │   ├── priority.ts
│   │   ├── sections/
│   │   ├── layout.ts
│   │   ├── renderer.ts
│   │   ├── renderers/
│   │   └── config.ts
│   ├── package.json
│   └── tsconfig.json
├── cli/                     # Existing: statusline-cli
│   └── package.json (depends on @statusline/core)
└── vscode/                  # Future: statusline-vscode
    └── package.json (depends on @statusline/core)
```

### 7.2 Publishing Setup `[ ]`
- `pnpm-workspace.yaml` or npm workspaces
- Build script: `tsc --project packages/core/tsconfig.json`
- Export map in `package.json`

---

## Phase 8: Test Coverage

### 8.1 Unit Tests `[ ]`
| Module | Coverage Target |
|--------|-----------------|
| `layout.ts` | 100% - all shrink scenarios |
| `sections/*.ts` | 90% - item generation |
| `config.ts` | 90% - override logic |
| `renderers/cli.ts` | 80% - ANSI output |

### 8.2 Integration Tests `[ ]`
- Full pipeline: fixture → adapter → unified → layout → renderer → output
- Snapshot tests for each width tier (120, 80, 60, 40, 25)
- Regression: Claude Code fixtures produce identical output

### 8.3 Property Tests `[ ]`
- `buildLayout` never exceeds width
- CRITICAL items always present
- Priority ordering preserved
- Section grouping maintained

---

## Phase 9: Documentation

### 9.1 User Docs `[ ]`
- `docs/configuration.md` - New section/item config schema
- `docs/sections.md` - Section reference with priorities

### 9.2 Developer Docs `[ ]`
- `docs/adding-sections.md` - How to add custom sections
- `docs/custom-renderers.md` - Implementing new renderers

---

## Checkpoint Commands

```bash
# Phase 1-3: Core model + layout
npm run checkpoint:sections-model    # Types compile, layout tests pass

# Phase 4: Renderers
npm run checkpoint:sections-renderers # CLI renderer produces valid ANSI

# Phase 5-6: CLI integration
npm run checkpoint:sections-cli      # All existing tests pass, output identical

# Phase 7: Package extraction
npm run checkpoint:sections-core     # @statusline/core builds, cli depends on it

# Phase 8-9: Tests + docs
npm run checkpoint:sections-all      # Full test suite + docs validation
```

---

## Migration Strategy

1. **Parallel implementation** - New core in `packages/core/`, old code untouched
2. **Feature flag** - `STATUSLINE_NEW_LAYOUT=1` enables new pipeline
3. **Validate** - Compare outputs for all fixtures at all widths
4. **Switch** - Make new pipeline default, remove flag
5. **Extract** - Move core to package, update CLI to depend on it
6. **Cleanup** - Remove old formatting code

---

## Success Criteria

- [ ] **Zero breaking changes** - Existing Claude Code/Cursor output identical
- [ ] **Predictable shrinking** - Priority order respected at every width
- [ ] **Extensible** - New sections/items added in <30 lines
- [ ] **Testable** - Pure layout function, 100% unit coverage
- [ ] **Multi-target** - Same layout → CLI, VS Code, Neovim, OpenCode
- [ ] **Configurable** - User can reorder, disable, reprioritize without code

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Shrinking algorithm bugs | Exhaustive width-tier tests + property tests |
| Config complexity | Sensible defaults, clear schema, migration guide |
| Performance | Pure functions, no allocations in hot path, memoize |
| Breaking existing output | Byte-for-byte comparison in CI for all fixtures |

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| 1-2: Model + Sections | 2 days |
| 3: Layout Engine | 1 day |
| 4: Renderers | 1 day |
| 5-6: CLI Integration | 1 day |
| 7: Package Extraction | 1 day |
| 8-9: Tests + Docs | 1 day |
| **Total** | **~7 days** |