/**
 * @statusline/core - Core library for section-priority-based status line rendering.
 * 
 * This package provides:
 * - Type definitions for sections, items, and priorities
 * - Priority constants and helpers
 * - Built-in sections for common status line elements
 * - Layout engine with priority-based shrinking
 */

// Types and models
export * from "./model.js";
export * from "./priority.js";

// Layout engine (Phase 3)
export { buildLayout, estimateWidth } from "./layout.js";

// Sections (Phase 2)
export * from "./sections/index.js";

// Renderers (Phase 4)
// export * from "./renderers/index.js";

// Configuration (Phase 5)
// export { applyConfig, DEFAULT_CONFIG } from "./config.js";