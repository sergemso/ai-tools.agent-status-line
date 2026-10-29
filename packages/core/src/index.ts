/**
 * @statusline/core - Core library for section-priority-based status line rendering.
 * 
 * This package provides:
 * - Type definitions for sections, items, and priorities
 * - Priority constants and helpers
 * - Built-in sections for common status line elements
 * - Layout engine with priority-based shrinking
 * - Renderer interface and implementations (CLI, VS Code, Neovim, OpenCode)
 * - Configuration system for user customization
 */

// Types and models
export * from "./model.js";
export * from "./priority.js";

// Layout engine (Phase 3)
export { buildLayout, estimateWidth } from "./layout.js";

// Sections (Phase 2)
export * from "./sections/index.js";

// Renderers (Phase 4)
export * from "./renderers/index.js";
// export * from "./renderer.js"; // getRenderer is re-exported from renderers/index
export * from "./colors.js";

// Configuration (Phase 5)
export * from "./config.js";