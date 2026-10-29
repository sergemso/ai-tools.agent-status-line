/**
 * ANSI color scheme for CLI renderer.
 * Extended from src/shared/colors.ts
 */

// ANSI color codes
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const ITALIC = "\x1b[3m";
export const UNDERLINE = "\x1b[4m";

// Foreground colors
export const BLACK = "\x1b[30m";
export const RED = "\x1b[31m";
export const GREEN = "\x1b[32m";
export const YELLOW = "\x1b[33m";
export const BLUE = "\x1b[34m";
export const MAGENTA = "\x1b[35m";
export const CYAN = "\x1b[36m";
export const WHITE = "\x1b[37m";
export const GRAY = "\x1b[90m";

// Bright foreground colors
export const BRIGHT_BLACK = "\x1b[90m";
export const BRIGHT_RED = "\x1b[91m";
export const BRIGHT_GREEN = "\x1b[92m";
export const BRIGHT_YELLOW = "\x1b[93m";
export const BRIGHT_BLUE = "\x1b[94m";
export const BRIGHT_MAGENTA = "\x1b[95m";
export const BRIGHT_CYAN = "\x1b[96m";
export const BRIGHT_WHITE = "\x1b[97m";

/** Apply color to text */
export function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

/** Style functions */
export const style = {
  reset: (text: string) => `${RESET}${text}${RESET}`,
  bold: (text: string) => `${BOLD}${text}${RESET}`,
  dim: (text: string) => `${DIM}${text}${RESET}`,
  italic: (text: string) => `${ITALIC}${text}${RESET}`,
  underline: (text: string) => `${UNDERLINE}${text}${RESET}`,
  
  // Colors
  black: (text: string) => colorize(text, BLACK),
  red: (text: string) => colorize(text, RED),
  green: (text: string) => colorize(text, GREEN),
  yellow: (text: string) => colorize(text, YELLOW),
  blue: (text: string) => colorize(text, BLUE),
  magenta: (text: string) => colorize(text, MAGENTA),
  cyan: (text: string) => colorize(text, CYAN),
  white: (text: string) => colorize(text, WHITE),
  gray: (text: string) => colorize(text, GRAY),
  
  // Bright colors
  brightRed: (text: string) => colorize(text, BRIGHT_RED),
  brightGreen: (text: string) => colorize(text, BRIGHT_GREEN),
  brightYellow: (text: string) => colorize(text, BRIGHT_YELLOW),
  brightBlue: (text: string) => colorize(text, BRIGHT_BLUE),
  brightMagenta: (text: string) => colorize(text, BRIGHT_MAGENTA),
  brightCyan: (text: string) => colorize(text, BRIGHT_CYAN),
  brightWhite: (text: string) => colorize(text, BRIGHT_WHITE),
};

/** Color scheme for sections */
export const sectionColors = {
  model: style.cyan,
  context: style.green,
  cost: style.yellow,
  cache: style.blue,
  "rate-limits": style.magenta,
  usage: style.white,
  vim: style.gray,
  worktree: style.gray,
  "cursor-extensions": style.gray,
} as const;

/** Color scheme for priority levels */
export const priorityColors = {
  critical: style.bold,
  high: style.white,
  medium: style.gray,
  low: style.dim,
  none: style.dim,
} as const;

/** Default color scheme object */
export const colors = {
  RESET,
  BOLD,
  DIM,
  BLACK,
  RED,
  GREEN,
  YELLOW,
  BLUE,
  MAGENTA,
  CYAN,
  WHITE,
  GRAY,
  BRIGHT_BLACK,
  BRIGHT_RED,
  BRIGHT_GREEN,
  BRIGHT_YELLOW,
  BRIGHT_BLUE,
  BRIGHT_MAGENTA,
  BRIGHT_CYAN,
  BRIGHT_WHITE,
  colorize,
  ...style,
  sectionColors,
  priorityColors,
} as const;