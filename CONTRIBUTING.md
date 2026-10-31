# Contributing

Contributions welcome — bug reports, fixtures, new adapters, renderer improvements, docs.

## Setup

```bash
git clone https://github.com/sergemso/ai-tools.agent-status-line.git
cd ai-tools.agent-status-line
npm install
npm run build:core    # build @statusline/core first (other packages depend on it)
npm run build         # build the main CLI
npm test
```

## Common tasks

| Task | Command |
|---|---|
| Run tests once | `npm test` |
| Watch tests | `npm run test:watch` |
| Build core only | `npm run build:core` |
| Build everything | `npm run build` |
| Lint | `npm run lint` |
| Smoke-test the packed tarballs (as CI does) | `npm run smoke:pack` |
| Regenerate the doc images (after building) | `npm run docs:images` |
| Add a test fixture | drop a JSON file in `test/fixtures/<agent>/`, add it to the loop in `test/adapters/adapter.test.ts` |

## Adding a new agent adapter

1. Read [`docs/adding-adapters.md`](docs/adding-adapters.md) — step-by-step guide.
2. Create `src/adapters/<agent>.ts` implementing `StatusLineAdapter`.
3. Register in `src/adapters/index.ts` (more specific adapters first).
4. Add fixtures in `test/fixtures/<agent>/` (basic, full, edge-empty, edge-null at minimum).
5. Run `npm test` — your adapter is auto-covered by the registry tests.

## Good first issues

- **Remove `formatter.legacy.ts`:** delete the legacy formatter and the fallback path once the new pipeline has proved stable.
- **Type safety:** replace `any` in `adaptInputForCore()` / `RenderContext.input` with a typed `CoreRenderInput`.
- **CI hardening:** make `npm run lint` a required gate (it is `continue-on-error` in `.github/workflows/ci.yml` until the ESLint config is finished).
- **Test isolation:** the integration tests read your real `~/.claude/statusline/config`, so a custom `SEPARATOR` or `FORMAT` makes `end-to-end.test.ts` fail locally. Point them at a temporary `CLAUDE_CONFIG_DIR`.
- **New renderer:** VS Code / Neovim renderers exist in `@statusline/core` but have no integration tests.

## Commit style and releases

Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`). They are not just style: releases are automated from them. A `feat:` or `fix:` that changes files in a package opens a Release PR for that package (`@statusline/core`, `@statusline/opencode-plugin`, or the root `@statusline/claude-plugin`); `docs:`, `test:` and `chore:` do not. Never bump versions by hand. See [`docs/releasing.md`](docs/releasing.md). Keep commits focused, and prefer squash-merging so one change produces one changelog entry.

## Pull requests

- One concern per PR. Large multi-phase refactors should be split.
- Include tests for new behavior. New adapters need fixtures.
- Update docs (`docs/`, `README.md`) if you change user-facing behavior.
- `npm test` must pass. `npm run build` must succeed.

How the code is organised: [`docs/architecture.md`](docs/architecture.md). Back to the [README](README.md).
