/**
 * Tests for the configuration system.
 */

import { describe, it, expect } from "vitest";
import { applyConfig, mergeConfig, validateConfig, DEFAULT_CONFIG } from "./config.js";
import type { Section, SectionItem, Priority } from "./model.js";
import { PriorityLevel as P } from "./priority.js";

// Test helpers
const createItem = (id: string, priority: Priority): SectionItem => ({
  id,
  content: id,
  priority,
});

const createSection = (id: string, priority: Priority, items: SectionItem[]): Section => ({
  id,
  name: id,
  priority,
  items,
});

describe("mergeConfig", () => {
  it("returns defaults when no user config", () => {
    const config = mergeConfig({});
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("merges section config", () => {
    const config = mergeConfig({
      sections: {
        model: { enabled: false },
      },
    });
    expect(config.sections.model?.enabled).toBe(false);
    expect(config.sections.context).toBeUndefined();
  });

  it("merges item config", () => {
    const config = mergeConfig({
      items: {
        "model.name": { priority: "HIGH" },
      },
    });
    expect(config.items["model.name"]?.priority).toBe("HIGH");
  });
});

describe("applyConfig", () => {
  it("disables section when enabled: false", () => {
    const sections = [
      createSection("model", P.CRITICAL, [createItem("name", P.CRITICAL)]),
      createSection("context", P.HIGH, [createItem("bar", P.HIGH)]),
    ];
    
    const config = { sections: { model: { enabled: false } } };
    const result = applyConfig(sections, config);
    
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("context");
  });

  it("overrides section priority", () => {
    const sections = [
      createSection("model", P.CRITICAL, [createItem("name", P.CRITICAL)]),
    ];
    
    const config = { sections: { model: { priority: "LOW" } } };
    const result = applyConfig(sections, config);
    
    expect(result[0].priority).toBe(P.LOW);
  });

  it("overrides item priority", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", P.CRITICAL),
        createItem("effort", P.MEDIUM),
      ]),
    ];
    
    const config = { items: { "model.effort": { priority: "HIGH" } } };
    const result = applyConfig(sections, config);
    
    const effortItem = result[0].items.find((i) => i.id === "effort");
    expect(effortItem?.priority).toBe(P.HIGH);
  });

  it("disables item when enabled: false", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", P.CRITICAL),
        createItem("effort", P.MEDIUM),
      ]),
    ];
    
    const config = { items: { "model.effort": { enabled: false } } };
    const result = applyConfig(sections, config);
    
    expect(result[0].items.length).toBe(1);
    expect(result[0].items[0].id).toBe("name");
  });

  it("applies global priority threshold", () => {
    const sections = [
      createSection("model", P.CRITICAL, [
        createItem("name", P.CRITICAL),
        createItem("effort", P.MEDIUM),
        createItem("costMult", P.LOW),
      ]),
    ];
    
    const config = { priorityThreshold: "HIGH" };
    const result = applyConfig(sections, config);
    
    expect(result[0].items.length).toBe(1);
    expect(result[0].items[0].id).toBe("name");
  });

  it("removes section with no items after threshold", () => {
    const sections = [
      createSection("model", P.CRITICAL, [createItem("name", P.CRITICAL)]),
      createSection("context", P.HIGH, [createItem("bar", P.HIGH)]),
    ];
    
    const config = { priorityThreshold: "CRITICAL" };
    const result = applyConfig(sections, config);
    
    // Only model section should remain (has CRITICAL item)
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("model");
  });

  it("uses sectionId.itemId key format for item config", () => {
    const sections = [
      createSection("model", P.CRITICAL, [createItem("name", P.CRITICAL)]),
      createSection("context", P.HIGH, [createItem("name", P.HIGH)]), // Same item id
    ];
    
    const config = { items: { "model.name": { priority: "LOW" } } };
    const result = applyConfig(sections, config);
    
    // Only model.name should be affected
    expect(result[0].items[0].priority).toBe(P.LOW);
    expect(result[1].items[0].priority).toBe(P.HIGH);
  });

  it("falls back to itemId key when sectionId.itemId not found", () => {
    const sections = [
      createSection("model", P.CRITICAL, [createItem("name", P.CRITICAL)]),
    ];
    
    const config = { items: { name: { priority: "LOW" } } };
    const result = applyConfig(sections, config);
    
    expect(result[0].items[0].priority).toBe(P.LOW);
  });
});

describe("validateConfig", () => {
  it("returns empty array for valid config", () => {
    const config = {
      sections: { model: { priority: "HIGH" } },
      items: { "model.name": { priority: "MEDIUM" } },
      priorityThreshold: "LOW",
    };
    const errors = validateConfig(config);
    expect(errors).toEqual([]);
  });

  it("validates section priority range", () => {
    const config = { sections: { model: { priority: 150 } } };
    const errors = validateConfig(config);
    expect(errors).toContain('Section "model": priority must be 0-100');
  });

  it("validates item priority range", () => {
    const config = { items: { "model.name": { priority: -10 } } };
    const errors = validateConfig(config);
    expect(errors).toContain('Item "model.name": priority must be 0-100');
  });

  it("validates minItems >= 0", () => {
    const config = { sections: { model: { minItems: -1 } } };
    const errors = validateConfig(config);
    expect(errors).toContain('Section "model": minItems must be >= 0');
  });

  it("validates minWidth >= 0", () => {
    const config = { items: { "model.name": { minWidth: -5 } } };
    const errors = validateConfig(config);
    expect(errors).toContain('Item "model.name": minWidth must be >= 0');
  });

  it("validates global priorityThreshold range", () => {
    const config = { priorityThreshold: 200 };
    const errors = validateConfig(config);
    expect(errors).toContain("priorityThreshold must be 0-100");
  });
});