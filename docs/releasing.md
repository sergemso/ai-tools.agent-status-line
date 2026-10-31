# Releasing

Releases are automated per package with [release-please](https://github.com/googleapis/release-please).

| Package | Path | Tag |
|---|---|---|
| `@statusline/claude-plugin` (CLI + Claude Code plugin + Cursor) | `.` | `claude-code-vX.Y.Z` |
| `@statusline/core` | `packages/core` | `core-vX.Y.Z` |
| `@statusline/opencode-plugin` | `packages/opencode-plugin` | `opencode-plugin-vX.Y.Z` |

## Flow

1. Merge Conventional Commits (`feat:`, `fix:`, `feat!:`) to `main`.
2. release-please opens or updates one Release PR per package whose files changed.
   The package is chosen by changed paths, not commit scope.
3. Merge a Release PR. It bumps the version and `CHANGELOG.md`, and tags the package.
   For the root package it also bumps `.claude-plugin/plugin.json`.
4. The `publish` job in `.github/workflows/release.yml` builds, tests, and publishes
   only the released packages to npm (core first). A GitHub Release is created per tag.

The Claude Code marketplace entry installs `@statusline/claude-plugin` from npm, so merging its Release PR is also what ships a plugin update to marketplace users.

Releasing `@statusline/core` also opens a bump for its dependents (`node-workspace`).

## Setup

- `NPM_TOKEN` secret for publishing.
- Optional `RELEASE_PLEASE_TOKEN` (PAT or app token): without it, Release PRs
  opened by `GITHUB_TOKEN` do not trigger CI.

Never edit versions by hand; the manifest is `.release-please-manifest.json`.
