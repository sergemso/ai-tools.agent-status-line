/**
 * Convert an ANSI-coloured string (as produced by @statusline/core's
 * CliRenderer) into an array of plain-text spans annotated with hex
 * colours, so it can be rendered by OpenCode's TUI (`<text fg={...}>`).
 *
 * OpenCode's `<text>` element from `@opentui/solid` does NOT interpret
 * raw ANSI escape sequences — passing them through would display the
 * literal `\x1b[...` bytes. This converter parses SGR sequences and
 * emits structured spans instead.
 *
 * Supported SGR codes (the subset emitted by @statusline/core sections):
 *   0  reset
 *  1  bold        (mapped to a brighter colour)
 *  2  dim         (mapped to a muted grey)
 *  22 normal intensity (resets bold+dim)
 *  31 red         32 green        33 yellow
 *  36 cyan
 *  90 bright black / grey
 *
 * Unrecognised SGR parameters are ignored (the text continues with the
 * current style). Non-SGR escape sequences are stripped.
 */

export interface Span {
  readonly text: string;
  readonly fg?: string;
  readonly bold?: boolean;
  readonly dim?: boolean;
}

// Colour palette — tuned for dark TUI backgrounds, matching the visual
// intent of @statusline/core's ANSI codes.
const COLORS: Record<number, string> = {
  30: "#666666", // black
  31: "#ff6b6b", // red
  32: "#69db7c", // green
  33: "#ffd93d", // yellow
  34: "#74c0fc", // blue
  35: "#da77f2", // magenta
  36: "#66d9e8", // cyan
  37: "#e0e0e0", // white
  90: "#808080", // bright black (grey)
  91: "#ff8787", // bright red
  92: "#b2f2bb", // bright green
  93: "#ffec99", // bright yellow
  94: "#a5d8ff", // bright blue
  95: "#eebefa", // bright magenta
  96: "#99e9f2", // bright cyan
  97: "#ffffff", // bright white
};

interface Style {
  fg?: string;
  bold: boolean;
  dim: boolean;
}

const DEFAULT_STYLE: Style = { bold: false, dim: false };

/** Parse an ANSI string into coloured spans. */
export function ansiToSpans(input: string): Span[] {
  const spans: Span[] = [];
  let current = DEFAULT_STYLE;
  let buffer = "";

  const flush = () => {
    if (buffer.length > 0) {
      spans.push({ text: buffer, ...current });
      buffer = "";
    }
  };

  // Tokenise: split on ESC sequences while keeping them.
  // eslint-disable-next-line no-control-regex
  const tokens = input.split(/(\x1b\[[0-9;]*[A-Za-z])/g);

  for (const token of tokens) {
    if (token === "") continue;

    // eslint-disable-next-line no-control-regex
    const sgrMatch = token.match(/^\x1b\[([0-9;]*)m$/);
    if (sgrMatch) {
      flush();
      current = applySgr(current, sgrMatch[1]);
      continue;
    }

    // Strip any other escape sequence (cursor movement, etc.).
    // eslint-disable-next-line no-control-regex
    if (/^\x1b\[/.test(token)) continue;

    buffer += token;
  }

  flush();
  return spans;
}

/** Apply an SGR parameter string to the current style, returning a new style. */
function applySgr(current: Style, params: string): Style {
  const codes = params === "" ? [0] : params.split(";").map((p) => parseInt(p, 10));

  let { fg, bold, dim } = current;

  for (const code of codes) {
    switch (code) {
      case 0:
        fg = undefined;
        bold = false;
        dim = false;
        break;
      case 1:
        bold = true;
        break;
      case 2:
        dim = true;
        break;
      case 22:
        bold = false;
        dim = false;
        break;
      default:
        if (COLORS[code]) {
          fg = COLORS[code];
        }
        break;
    }
  }

  return { fg, bold, dim };
}

/**
 * Render spans into a flat plain-text string (ANSI stripped).
 *
 * Useful for tests and for measuring visible width.
 */
export function spansToPlainText(spans: readonly Span[]): string {
  return spans.map((s) => s.text).join("");
}
