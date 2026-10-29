/**
 * Core data model for section-priority-based rendering.
 * Defines types for sections, items, priorities, and render context.
 */

// Priority levels (0-100), higher = more important (kept longer when shrinking)
export type Priority = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;

// Named priority constants for readability
export const Priority = {
  NONE: 0 as Priority,
  LOW: 10 as Priority,
  MEDIUM: 30 as Priority,
  HIGH: 70 as Priority,
  CRITICAL: 100 as Priority,
} as const;

// Content types that can be rendered
export type SectionItemContent =
  | string                                    // Static content
  | ((ctx: RenderContext) => string)          // Dynamic content function
  | {                                         // Templated content
      template: string;
      values: Record<string, any>;
      fallback?: string;
    }
  | {                                         // Rich content (future)
      parts: Array<{ text: string; style?: string; color?: string }>;
    };

// Visibility condition
export type VisibleWhen = (ctx: RenderContext) => boolean;

// Hints for layout/rendering
export interface SectionItemHints {
  /** Minimum width this item needs (chars) */
  minWidth?: number;
  /** Ideal width when space permits (chars) */
  idealWidth?: number;
  /** Whether item can be truncated */
  truncatable?: boolean;
  /** Truncation suffix */
  truncateSuffix?: string;
  /** Alignment within allocated width */
  align?: "left" | "center" | "right";
  /** Custom separator after this item */
  separator?: string;
}

// An atomic display unit within a section
export interface SectionItem {
  /** Unique identifier within the section */
  id: string;
  /** Content to render */
  content: SectionItemContent;
  /** Priority for shrinking (higher = kept longer) */
  priority: Priority;
  /** Minimum width needed */
  minWidth?: number;
  /** Ideal width when space permits */
  idealWidth?: number;
  /** Optional visibility condition */
  visibleWhen?: VisibleWhen;
  /** Layout/rendering hints */
  hints?: SectionItemHints;
}

// A logical group of related items
export interface Section {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Section priority for ordering and shrinking */
  priority: Priority;
  /** Items in this section, in display order */
  items: SectionItem[];
  /** Optional visibility condition for entire section */
  visibleWhen?: VisibleWhen;
  /** Minimum number of items to keep from this section */
  minItems?: number;
}

// Layout result after priority-based shrinking
export interface SectionLayout {
  /** Sections with their kept items, in display order */
  sections: Section[];
  /** Layout metadata */
  meta: {
    /** Total width of all items before shrinking */
    totalWidth: number;
    /** Available width for rendering */
    availableWidth: number;
    /** Whether content was truncated */
    overflow: boolean;
    /** Items that were dropped due to width constraints */
    droppedItems: Array<{ sectionId: string; itemId: string; priority: Priority }>;
  };
}

// Rendering target platforms
export type RenderTarget = "cli" | "vscode" | "neovim" | "opencode";

// Context passed to render functions
export interface RenderContext {
  /** Unified input data from adapter */
  input: any;
  /** Available width in characters */
  width: number;
  /** Target platform */
  target: RenderTarget;
  /** User configuration */
  config: UserConfig;
  /** Theme/color scheme */
  theme?: ThemeConfig;
  /** Whether width is constrained (false for auto-detect/legacy behavior) */
  widthConstrained?: boolean;
}

// User configuration for sections and items
export interface UserConfig {
  /** Section-level overrides */
  sections?: Record<string, SectionConfig>;
  /** Item-level overrides */
  items?: Record<string, ItemConfig>;
  /** Global priority threshold - items below this are hidden */
  priorityThreshold?: Priority;
  /** Separator between sections */
  sectionSeparator?: string;
  /** Separator between items within a section */
  itemSeparator?: string;
  /** Context warning threshold (percentage) */
  contextWarn?: number;
  /** Context critical threshold (percentage) */
  contextCrit?: number;
  /** Cache warning threshold (minutes) */
  cacheWarn?: number;
  /** Cache critical threshold (minutes) */
  cacheCrit?: number;
  /** Reset warning threshold (percentage) */
  resetWarn?: number;
  /** Reset critical threshold (percentage) */
  resetCrit?: number;
  /** Overhead warning threshold (cents) */
  overheadWarn?: number;
  /** Overhead critical threshold (cents) */
  overheadCrit?: number;
}

// Section configuration override
export interface SectionConfig {
  /** Enable/disable section */
  enabled?: boolean;
  /** Override section priority */
  priority?: Priority;
  /** Override minimum items to keep */
  minItems?: number;
  /** Filter for rate-limits section (list of window IDs to show) */
  resets?: string[];
}

// Item configuration override
export interface ItemConfig {
  /** Enable/disable item */
  enabled?: boolean;
  /** Override item priority */
  priority?: Priority;
  /** Override minimum width */
  minWidth?: number;
}

// Theme configuration for renderers
export interface ThemeConfig {
  /** ANSI color scheme for CLI */
  colors?: Record<string, string>;
  /** VS Code theme colors */
  vscode?: Record<string, string>;
  /** Neovim highlight groups */
  neovim?: Record<string, string>;
}

// Default configuration
export const DEFAULT_CONFIG: Required<UserConfig> = {
  sections: {},
  items: {},
  priorityThreshold: Priority.NONE,
  sectionSeparator: " | ",
  itemSeparator: " ",
  contextWarn: 50,
  contextCrit: 80,
  cacheWarn: 20,
  cacheCrit: 5,
  resetWarn: 50,
  resetCrit: 80,
  overheadWarn: 5,
  overheadCrit: 20,
};