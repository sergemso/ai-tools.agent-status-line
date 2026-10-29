/**
 * Priority constants and helper functions for section-priority-based rendering.
 */

import { Priority } from "./model.js";

/**
 * All valid priority values in ascending order.
 */
export const PRIORITY_VALUES: Priority[] = [
  0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
];

/**
 * Priority labels for display/debugging.
 */
export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "NONE",
  10: "LOW",
  20: "LOW+",
  30: "MEDIUM",
  40: "MEDIUM+",
  50: "MEDIUM++",
  60: "HIGH-",
  70: "HIGH",
  80: "HIGH+",
  90: "CRITICAL-",
  100: "CRITICAL",
};

/**
 * Get the label for a priority value.
 */
export function getPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority] ?? `P${priority}`;
}

/**
 * Check if a priority is at or above a threshold.
 */
export function meetsThreshold(priority: Priority, threshold: Priority): boolean {
  return priority >= threshold;
}

/**
 * Compare two priorities (for sorting, descending = higher priority first).
 */
export function comparePriority(a: Priority, b: Priority): number {
  return b - a; // Descending: higher priority first
}

/**
 * Get the next lower priority level.
 */
export function nextLowerPriority(priority: Priority): Priority {
  const index = PRIORITY_VALUES.indexOf(priority);
  if (index <= 0) return 0;
  return PRIORITY_VALUES[index - 1];
}

/**
 * Get the next higher priority level.
 */
export function nextHigherPriority(priority: Priority): Priority {
  const index = PRIORITY_VALUES.indexOf(priority);
  if (index >= PRIORITY_VALUES.length - 1) return 100;
  return PRIORITY_VALUES[index + 1];
}

/**
 * Composite priority for sorting: sectionPriority * 1000 + itemPriority.
 * This ensures section priority dominates, then item priority within section.
 */
export function compositePriority(sectionPriority: Priority, itemPriority: Priority): number {
  return sectionPriority * 1000 + itemPriority;
}

/**
 * Parse priority from string (config).
 */
export function parsePriority(value: string | number | undefined): Priority {
  if (typeof value === "number") {
    // Clamp to valid range and round to nearest 10
    const clamped = Math.max(0, Math.min(100, Math.round(value / 10) * 10));
    return clamped as Priority;
  }
  if (typeof value === "string") {
    const upper = value.toUpperCase();
    const labelToPriority: Record<string, Priority> = {
      NONE: 0,
      LOW: 10,
      "LOW+": 20,
      MEDIUM: 30,
      "MEDIUM+": 40,
      "MEDIUM++": 50,
      "HIGH-": 60,
      HIGH: 70,
      "HIGH+": 80,
      "CRITICAL-": 90,
      CRITICAL: 100,
    };
    return labelToPriority[upper] ?? parsePriority(parseInt(upper, 10));
  }
  return 0;
}

/**
 * Priority thresholds for common use cases.
 */
export const PriorityThresholds = {
  /** Show everything */
  ALL: 0 as Priority,
  /** Hide NONE priority items */
  ESSENTIAL: 10 as Priority,
  /** Show only MEDIUM and above */
  STANDARD: 30 as Priority,
  /** Show only HIGH and above */
  COMPACT: 70 as Priority,
  /** Show only CRITICAL items */
  MINIMAL: 100 as Priority,
} as const;