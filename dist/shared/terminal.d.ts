/**
 * Detect terminal columns from /dev/tty or parent process tty
 * Returns 0 if unable to detect
 */
export declare function detectCols(): Promise<number>;
/**
 * Calculate visible width of a string (strip ANSI codes, count block chars as 1)
 */
export declare function visibleWidth(str: string): number;
//# sourceMappingURL=terminal.d.ts.map