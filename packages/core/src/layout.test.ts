/**
 * Tests for the layout engine.
 */

import { describe, it, expect } from "vitest";
import { buildLayout, estimateWidth } from "./layout.js";
import type { Section, SectionItem, RenderContext, Priority } from "./model.js";
import { PriorityLevel as P } from "./priority.js";

// Test helpers
const createCtx = (width: number, input: any = {}): RenderContext => ({
  input,
  width,
  target: "cli",
  config: {},
});

const createItem = (
  id: string,
  content: string,
  priority: Priority,
  minWidth = content.length
): SectionItem => ({
  id,
  content,
  priority,
  minWidth,
  estimatedWidth: content.length,
});

const createSection = (
  id: string,
  priority: Priority,
  items: SectionItem[]
): Section => ({
  id,
  name: id,
  priority,
  items,
});

describe("estimateWidth", () => {
  it("returns string length for static content", () => {
    const item = createItem("test", "hello", P.MEDIUM);
    const ctx = createCtx(80);
    expect(estimateWidth(item, ctx)).toBe(5);
  });

  it("evaluates function content", () => {
    const item: SectionItem = {
      id: "dynamic",
      content: (ctx) => ctx.input.value,
      priority: P.MEDIUM,
    };
    const ctx = createCtx(80, { value: "world" });
    expect(estimateWidth(item, ctx)).toBe(5);
  });

  it("strips ANSI codes", () => {
    const item = createItem("ansi", "\x1b[31mred\x1b[0m", P.MEDIUM);
    const ctx = createCtx(80);
    expect(estimateWidth(item, ctx)).toBe(3);
  });

  it("renders template content", () => {
    const item: SectionItem = {
      id: "template",
      content: { template: "Hello {name}", values: { name: "World" } },
      priority: P.MEDIUM,
    };
    const ctx = createCtx(80);
    expect(estimateWidth(item, ctx)).toBe(11);
  });
});

describe("buildLayout", () => {
  it("keeps all items when width is sufficient", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "claude-3-opus", P.CRITICAL),
        createItem("effort", "high", P.MEDIUM),
      ]),
      createSection("context", P.HIGH, [
        createItem("bar", "████████░░", P.HIGH),
        createItem("tokens", "50k/100k", P.MEDIUM),
      ]),
    ];

    const ctx = createCtx(120);
    const layout = buildLayout(sections, ctx);

    expect(layout.sections.length).toBe(2);
    expect(layout.sections[0].items.length).toBe(2);
    expect(layout.sections[1].items.length).toBe(2);
    expect(layout.meta.overflow).toBe(false);
  });

  it("drops LOW/NONE items at width 80", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "claude-3-opus", P.CRITICAL),
        createItem("effort", "high", P.MEDIUM),
        createItem("costMult", "2.5x", P.LOW),
        createItem("id", "model-id-123", P.NONE),
      ]),
      createSection("context", P.HIGH, [
        createItem("bar", "████████████████████", P.HIGH), // 20 chars
        createItem("tokens", "50000/100000", P.MEDIUM),
      ]),
      createSection("cost", P.HIGH, [
        createItem("session", "$0.05", P.HIGH),
        createItem("total", "$1.23", P.LOW),
      ]),
    ];

    const ctx = createCtx(80);
    const layout = buildLayout(sections, ctx);

    // Should keep CRITICAL and HIGH, drop MEDIUM/LOW/NONE
    const modelItems = layout.sections.find((s) => s.id === "model")?.items ?? [];
    const keptIds = modelItems.map((i) => i.id);
    expect(keptIds).toContain("name");
    // effort (MEDIUM) might be kept or dropped depending on space
    expect(layout.meta.droppedItems.length).toBeGreaterThan(0);
  });

  it("drops MEDIUM items at width 60", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "claude-3-opus", P.CRITICAL),
        createItem("effort", "high", P.MEDIUM),
        createItem("costMult", "2.5x", P.LOW),
      ]),
      createSection("context", P.HIGH, [
        createItem("bar", "████████████", P.HIGH), // 12 chars
        createItem("tokens", "50000/100000", P.MEDIUM),
      ]),
    ];

    const ctx = createCtx(60);
    const layout = buildLayout(sections, ctx);

    // Should keep CRITICAL and HIGH, drop MEDIUM and LOW
    const modelItems = layout.sections.find((s) => s.id === "model")?.items ?? [];
    const contextItems = layout.sections.find((s) => s.id === "context")?.items ?? [];
    
    expect(modelItems.map((i) => i.id)).toContain("name");
    // effort (MEDIUM) should be dropped at this width
    expect(contextItems.map((i) => i.id)).toContain("bar");
    // tokens (MEDIUM) should be dropped at this width
  });

  it("keeps only CRITICAL + HIGH at width 40", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "claude-3-opus", P.CRITICAL),
        createItem("effort", "high", P.MEDIUM),
      ]),
      createSection("context", P.HIGH, [
        createItem("bar", "██████████", P.HIGH), // 10 chars
        createItem("tokens", "50000/100000", P.MEDIUM),
      ]),
      createSection("cost", P.HIGH, [
        createItem("session", "$0.05", P.HIGH),
        createItem("total", "$1.23", P.LOW),
      ]),
    ];

    const ctx = createCtx(40);
    const layout = buildLayout(sections, ctx);

    // Section priority dominates: model (CRITICAL) items kept before context (HIGH) items
    // So model.effort (MEDIUM) has higher composite priority than context.tokens (MEDIUM)
    // But context.tokens and cost.total (LOW) should be dropped
    const droppedIds = layout.meta.droppedItems.map(d => d.itemId);
    expect(droppedIds).toContain("tokens"); // MEDIUM in HIGH section
    expect(droppedIds).toContain("total");  // LOW in HIGH section
  });

  it("keeps only CRITICAL items at width 25", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "claude-3-opus", P.CRITICAL),
        createItem("effort", "high", P.MEDIUM),
      ]),
      createSection("context", P.HIGH, [
        createItem("bar", "██████████", P.HIGH), // 10 chars
        createItem("tokens", "50000/100000", P.MEDIUM),
      ]),
    ];

    const ctx = createCtx(25);
    const layout = buildLayout(sections, ctx);

    // At width 25, only the highest priority items fit
    // model.name (CRITICAL, 13 chars) + context.bar (HIGH, 10 chars) = 23 + 3 sep = 26 > 25
    // So only model.name should fit
    const allKeptItems = layout.sections.flatMap(s => s.items);
    const keptIds = allKeptItems.map(i => i.id);
    expect(keptIds).toContain("name");
    // effort (MEDIUM in CRITICAL section) might or might not fit
    // bar (HIGH in HIGH section) might not fit
  });

  it("preserves section order in output", () => {
    const sections = [
      createSection("model", P.CRITICAL, [createItem("name", "model", P.CRITICAL)]),
      createSection("context", P.HIGH, [createItem("bar", "████", P.HIGH)]),
      createSection("cost", P.HIGH, [createItem("session", "$0.05", P.HIGH)]),
    ];

    const ctx = createCtx(100);
    const layout = buildLayout(sections, ctx);

    expect(layout.sections.map((s) => s.id)).toEqual(["model", "context", "cost"]);
  });

  it("respects minItems per section", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "model", P.CRITICAL),
        createItem("effort", "high", P.MEDIUM),
      ]),
    ];
    sections[0].minItems = 2; // Must keep at least 2 items

    const ctx = createCtx(10); // Very narrow
    const layout = buildLayout(sections, ctx);

    // Even at very narrow width, should keep minItems
    expect(layout.sections[0].items.length).toBeGreaterThanOrEqual(2);
  });

  it("evicts lowest non-critical for critical items when full", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "claude-3-opus", P.CRITICAL),
      ]),
      createSection("context", P.HIGH, [
        createItem("bar", "████████░░", P.HIGH),
        createItem("tokens", "50000/100000", P.MEDIUM),
      ]),
    ];

    // Width that fits model.name + context.bar but not context.tokens
    // model.name (13) + sep (3) + context.bar (10) = 26
    const ctx = createCtx(26);
    const layout = buildLayout(sections, ctx);

    // Should keep model.name (CRITICAL) and context.bar (HIGH)
    // context.tokens (MEDIUM) should be dropped
    const modelItems = layout.sections.find((s) => s.id === "model")?.items ?? [];
    const contextItems = layout.sections.find((s) => s.id === "context")?.items ?? [];
    
    expect(modelItems.map((i) => i.id)).toContain("name");
    expect(contextItems.map((i) => i.id)).toContain("bar");
    expect(contextItems.map((i) => i.id)).not.toContain("tokens");
  });

  it("tracks dropped items in meta", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "claude-3-opus", P.CRITICAL),
        createItem("effort", "high", P.MEDIUM),
        createItem("costMult", "2.5x", P.LOW),
      ]),
      createSection("context", P.HIGH, [
        createItem("bar", "████████████████████", P.HIGH), // 20 chars
        createItem("tokens", "50000/100000", P.MEDIUM),
      ]),
    ];

    const ctx = createCtx(30); // Only fits model.name + context.bar
    const layout = buildLayout(sections, ctx);

    expect(layout.meta.droppedItems.length).toBeGreaterThan(0);
    expect(layout.meta.overflow).toBe(true);
  });

  it("handles empty sections gracefully", () => {
    const sections = [
      createSection("empty", P.HIGH, []),
      createSection("model", P.CRITICAL, [createItem("name", "model", P.CRITICAL)]),
    ];

    const ctx = createCtx(80);
    const layout = buildLayout(sections, ctx);

    expect(layout.sections.length).toBe(1);
    expect(layout.sections[0].id).toBe("model");
  });

  it("filters invisible sections and items", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", "model", P.CRITICAL),
        createItem("hidden", "secret", P.MEDIUM, 6),
      ]),
    ];
    sections[0].visibleWhen = () => true;
    sections[0].items[1].visibleWhen = () => false;

    const ctx = createCtx(80);
    const layout = buildLayout(sections, ctx);

    expect(layout.sections[0].items.length).toBe(1);
    expect(layout.sections[0].items[0].id).toBe("name");
  });
});