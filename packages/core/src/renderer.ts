/**
 * Renderer interface for target-agnostic rendering.
 * Each target (CLI, VS Code, Neovim, OpenCode) implements this interface.
 */

import type { Section, SectionItem, SectionLayout, RenderContext, RenderTarget } from "./model.js";

/**
 * Generic renderer interface.
 * TOutput is the target-specific output type for the complete layout.
 * TItemOutput is the output type for a single item (usually same as TOutput for CLI, but component for others).
 */
export interface Renderer<TOutput, TItemOutput = TOutput> {
  /** Target platform identifier */
  readonly target: RenderTarget;
  
  /** Render the complete layout to target output */
  render(layout: SectionLayout, ctx: RenderContext): TOutput;
  
  /** Measure the rendered width of an item (for layout calculations) */
  measureItem(item: SectionItem, ctx: RenderContext): number;
  
  /** Render a single item to target item output */
  renderItem(item: SectionItem, ctx: RenderContext): TItemOutput;
  
  /** Join multiple rendered items with a separator */
  join(items: TItemOutput[], separator: TItemOutput): TOutput;
}

/**
 * Base renderer class with common functionality.
 * Subclasses implement target-specific rendering.
 */
export abstract class BaseRenderer<TOutput, TItemOutput = TOutput> implements Renderer<TOutput, TItemOutput> {
  abstract readonly target: RenderTarget;
  
  abstract render(layout: SectionLayout, ctx: RenderContext): TOutput;
  abstract renderItem(item: SectionItem, ctx: RenderContext): TItemOutput;
  abstract join(items: TItemOutput[], separator: TItemOutput): TOutput;
  
  /**
   * Default width measurement - strips ANSI and returns length.
   * Subclasses can override for target-specific measurement.
   */
  measureItem(item: SectionItem, ctx: RenderContext): number {
    let content = "";
    
    if (typeof item.content === "string") {
      content = item.content;
    } else if (typeof item.content === "function") {
      content = item.content(ctx);
    } else if ("template" in item.content) {
      const { template, values, fallback } = item.content;
      try {
        content = template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? fallback ?? ""));
      } catch {
        content = fallback ?? "";
      }
    } else if ("parts" in item.content) {
      content = item.content.parts.map((p) => p.text).join("");
    }
    
    // Strip ANSI escape codes
    return content.replace(/\x1b\[[0-9;]*m/g, "").length;
  }
  
  /**
   * Resolve item content to string (common implementation).
   */
  protected resolveContent(item: SectionItem, ctx: RenderContext): string {
    if (typeof item.content === "string") {
      return item.content;
    }
    if (typeof item.content === "function") {
      return item.content(ctx);
    }
    if ("template" in item.content) {
      const { template, values, fallback } = item.content;
      try {
        return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? fallback ?? ""));
      } catch {
        return fallback ?? "";
      }
    }
    if ("parts" in item.content) {
      return item.content.parts.map((p) => p.text).join("");
    }
    return "";
  }
}

/**
 * Renderer factory - creates appropriate renderer for target.
 */
export function getRenderer<TOutput, TItemOutput = TOutput>(target: RenderTarget): Renderer<TOutput, TItemOutput> {
  // This will be implemented in renderers/index.ts
  throw new Error(`Renderer for target "${target}" not implemented. Import from renderers/index.ts`);
}