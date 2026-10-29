/**
 * Unicode-aware visible width calculation.
 *
 * Strips ANSI escape sequences and counts display columns, treating
 * East-Asian Wide / Fullwidth and common emoji as width 2 (matching
 * the legacy `visibleWidth` from `src/shared/terminal.ts`).
 *
 * This is the single source of truth for width measurement inside
 * @statusline/core; both `layout.ts` (estimateWidth) and the CLI
 * renderer (measureItem) delegate here. Keep the two implementations
 * in sync by editing only this file.
 */

// Block characters used by the context bar — count as 1 column each,
// matching the legacy `visibleWidth` from src/shared/terminal.ts.
// (U+2581..U+2588 plus the borders U+2595 / U+258F are all narrow in
// Unicode East Asian Width, but the legacy implementation treats them
// explicitly as single-width and the bar layout depends on that.)
const BLOCK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▕", "▏"];

/**
 * Test whether a code point should be treated as wide (display column 2).
 *
 * Covers the most common cases: CJK, Hiragana/Katakana, Hangul, CJK
 * punctuation, fullwidth forms, and a representative range of emoji
 * (including the Emoji Presentation block and common supplementary
 * pictographs). Zero-width joiners and combining marks are handled
 * separately (they contribute 0 columns).
 */
/** Some terminals draw U+26A1 / U+1F195 one cell wide; the wizard measures it. Default: two cells. */
let emojiWide = true;
export function setEmojiWidth(n: number): void {
  emojiWide = n !== 1;
}

function isWide(codePoint: number): boolean {
  return (
    // Hangul Jamo (compatibility) and CJK Radicals
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    // CJK Unified Ideographs and friends
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    // Fullwidth / Halfwidth forms
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    // Misc CJK / Kanbun
    (codePoint >= 0x20000 && codePoint <= 0x2fffd) ||
    (codePoint >= 0x30000 && codePoint <= 0x3fffd) ||
    // Emoji with default emoji presentation (U+26A1 high voltage)
    (emojiWide && (codePoint === 0x26a1 || codePoint === 0x1f195)) ||
    // Emoji blocks
    (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f680 && codePoint <= 0x1f6ff) ||
    (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x1fa70 && codePoint <= 0x1faff) ||
    (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff) // regional indicators
  );
}

/**
 * Test whether a code point contributes 0 columns:
 * combining marks, variation selectors, ZWJ, ZWNJ.
 */
function isZeroWidth(codePoint: number): boolean {
  return (
    codePoint === 0x200d || // ZWJ
    codePoint === 0xfe0f || // VS-16
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || // Variation Selectors
    (codePoint >= 0x0300 && codePoint <= 0x036f) || // Combining Diacritical Marks
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) || // Combining Diacritical Marks Extended
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) || // Combining Diacritical Marks Supplement
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) || // Combining Diacritical Marks for Symbols
    (codePoint >= 0x2de0 && codePoint <= 0x2dff) // Cyrillic Extended-A
  );
}

/**
 * Calculate the visible display width of a string.
 *
 * 1. Strips ANSI escape sequences (SGR and cursor-movement).
 * 2. Replaces each context-bar block character with a single-width
 *    placeholder (matches legacy behavior for ▁▂▃▄▅▆▇█▕▏).
 * 3. Iterates by code point, counting wide CJK/emoji chars as 2,
 *    combining marks / ZWJ / VS as 0, and everything else as 1.
 */
export function visibleWidth(input: string): number {
  // 1. Strip ANSI escape sequences (not just SGR — also covers cursor
  //    movement, erase, etc., to be safe against any decorated content).
  let text = input.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

  // 2. Normalise block chars to a single-width placeholder.
  for (const ch of BLOCK_CHARS) {
    if (text.indexOf(ch) !== -1) {
      text = text.split(ch).join("x");
    }
  }

  // 3. Walk by code point and sum display columns.
  let width = 0;
  // Iterate UTF-16 code units but jump over surrogate pairs.
  for (let i = 0; i < text.length; ) {
    const code = text.codePointAt(i)!;
    const step = code > 0xffff ? 2 : 1;

    if (isZeroWidth(code)) {
      // contributes nothing
    } else if (isWide(code)) {
      width += 2;
    } else {
      width += 1;
    }

    i += step;
  }

  return width;
}
