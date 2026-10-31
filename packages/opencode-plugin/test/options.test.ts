/**
 * Plugin option handling. tui.tsx itself needs the OpenCode runtime and a JSX
 * transform, so the decisions it makes (slot, sections, gutter) live in
 * src/options.ts and are tested here.
 */

import { describe, it, expect } from "vitest";
import {
  FOOTER_GUTTER,
  resolveOptions,
  slotTarget,
  type Placement,
} from "../src/options.js";
import { adaptSession } from "../src/adapter.js";
import { renderStatusLine } from "../src/render.js";
import { ansiToSpans, spansToPlainText } from "../src/ansi.js";
import type { SessionInfo, ModelInfo } from "../src/types.js";

describe("resolveOptions", () => {
  it("defaults to replacing the footer status slot with the footer section set", () => {
    expect(resolveOptions(undefined)).toEqual({
      placement: "replace",
      shared: true,
      sections: "model,tokens,resets",
      margin: FOOTER_GUTTER,
    });
  });

  it.each(["replace", "append"] as const)("%s shares the footer row", (placement) => {
    const resolved = resolveOptions({ placement });
    expect(resolved.shared).toBe(true);
    expect(resolved.sections).toBe("model,tokens,resets");
    expect(resolved.margin).toBe(FOOTER_GUTTER);
  });

  it("composer-top has its own row: full sections, no gutter", () => {
    const resolved = resolveOptions({ placement: "composer-top" });
    expect(resolved.shared).toBe(false);
    expect(resolved.sections).toBe("model,context,cost,tokens,resets");
    expect(resolved.margin).toBe(0);
  });

  it("never enables the worktree section by default", () => {
    for (const placement of ["replace", "append", "composer-top"] as const) {
      expect(resolveOptions({ placement }).sections).not.toContain("worktree");
    }
  });

  it("an explicit sections option wins in every placement", () => {
    for (const placement of ["replace", "append", "composer-top"] as const) {
      expect(resolveOptions({ placement, sections: "model,cost" }).sections).toBe("model,cost");
    }
  });

  it("ignores an empty sections string", () => {
    expect(resolveOptions({ sections: "" }).sections).toBe("model,tokens,resets");
  });

  it("falls back to replace for an unknown placement or a non-object", () => {
    expect(resolveOptions({ placement: "sidebar" }).placement).toBe("replace");
    expect(resolveOptions("nonsense").placement).toBe("replace");
    expect(resolveOptions(null).placement).toBe("replace");
  });
});

describe("slotTarget", () => {
  const cases: Array<[Placement, object]> = [
    ["replace", { replace: "prompt.footer.status" }],
    ["append", { append: "prompt.footer.status" }],
    ["composer-top", { append: "session.composer.top" }],
  ];
  it.each(cases)("%s claims the right slot", (placement, expected) => {
    expect(slotTarget(placement)).toEqual(expected);
  });

  it("names exactly one placement key", () => {
    for (const [placement] of cases) {
      expect(Object.keys(slotTarget(placement))).toHaveLength(1);
    }
  });
});

describe("footer gutter", () => {
  const model: ModelInfo = {
    id: "m",
    providerID: "p",
    name: "GLM-5.2",
    limit: { context: 1_000_000, output: 8_000 },
    cost: { input: 1, output: 2 },
  } as unknown as ModelInfo;
  const session = {
    id: "s",
    model: { id: "m", providerID: "p" },
    cost: 0.94,
    tokens: { input: 60_000, output: 15_200, reasoning: 0, cache: { read: 0, write: 0 } },
  } as unknown as SessionInfo;
  const input = adaptSession(session, { resolveModel: () => model });

  it("leaves the gutter free at every slot width", () => {
    const resolved = resolveOptions({});
    for (const slotWidth of [30, 50, 70, 100, 140]) {
      const ansi = renderStatusLine(input, {
        width: slotWidth,
        margin: resolved.margin,
        widthConstrained: true,
        sections: resolved.sections,
      });
      const text = spansToPlainText(ansiToSpans(ansi));
      expect([...text].length).toBeLessThanOrEqual(slotWidth - FOOTER_GUTTER);
    }
  });
});
