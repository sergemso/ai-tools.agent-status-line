/**
 * Tests for the configurable section separator and per-window rate-limit groups.
 */

import { describe, it, expect } from "vitest";
import { buildLayout } from "./layout.js";
import { cliRenderer } from "./renderers/cli.js";
import { getSections } from "./sections/index.js";
import { visibleWidth } from "./width.js";
import type { RenderContext, UserConfig } from "./model.js";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

const input = {
  model: { displayName: "M", capabilities: {} },
  rateLimits: [
    { window: "5h", limit: 100, remaining: 94, resetsAt: Math.floor(Date.now() / 1000) + 5820 },
    { window: "7d", limit: 100, remaining: 99, resetsAt: Math.floor(Date.now() / 1000) + 600000 },
  ],
};

const render = (config: UserConfig, width = 200) => {
  const ctx: RenderContext = { input, width, target: "cli", config, formatLevel: "glyph" };
  const layout = buildLayout(getSections(config, ctx), ctx);
  return { layout, line: strip(cliRenderer.render(layout, ctx)) };
};

describe("rate-limit windows", () => {
  it("are separate groups, so the section separator sits between them", () => {
    const { layout, line } = render({ sections: { "rate-limits": { enabled: true } } });
    const ids = layout.sections.map((s) => s.id).filter((id) => id.startsWith("rate-limits"));
    expect(ids).toEqual(["rate-limits.window-5h", "rate-limits.window-7d"]);
    expect(line).toMatch(/6% \S+\/5h \| 1% \S+\/7d/);
  });
});

describe("sectionSeparator", () => {
  it("is drawn between groups", () => {
    const { line } = render({ sectionSeparator: " · ", sections: { "rate-limits": { enabled: true } } });
    expect(line).toMatch(/\/5h · 1%/);
    expect(line).not.toContain("|");
  });

  it("counts toward the layout width", () => {
    const wide = render({ sectionSeparator: " ··· ", sections: { "rate-limits": { enabled: true } } });
    const narrow = render({ sectionSeparator: " | ", sections: { "rate-limits": { enabled: true } } });
    expect(visibleWidth(wide.line)).toBe(visibleWidth(narrow.line) + 2);
    expect(wide.layout.meta.totalWidth).toBe(narrow.layout.meta.totalWidth + 2);
  });
});
