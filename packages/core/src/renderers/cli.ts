/**
 * CLI Renderer - renders to ANSI-colored string for terminal output.
 * 
 * This renderer assumes sections provide pre-colored content (matching legacy behavior).
 * It does NOT apply additional priority-based styling.
 */

import type { Section, SectionItem, SectionLayout, RenderContext } from "../model.js";
import type { Renderer } from "../renderer.js";
import { style } from "../colors.js";

/** CLI Renderer - outputs ANSI-colored string */
export class CliRenderer implements Renderer<string, string> {
  readonly target = "cli" as const;
  
  render(layout: SectionLayout, ctx: RenderContext): string {
    const sectionSeparator = this.getSectionSeparator(ctx);
    return this.renderSections(layout, ctx, sectionSeparator);
  }
  
  measureItem(item: SectionItem, ctx: RenderContext): number {
    const content = this.resolveContent(item, ctx);
    return content.replace(/\x1b\[[0-9;]*m/g, "").length;
  }
  
  renderItem(item: SectionItem, ctx: RenderContext): string {
    return this.resolveContent(item, ctx);
  }
  
  join(items: string[], separator: string): string {
    return items.join(separator);
  }
  
  protected getItemSeparator(ctx: RenderContext): string {
    // Dim pipe separator with spaces (matches legacy)
    return style.dim(" | ");
  }
  
  protected getSectionSeparator(ctx: RenderContext): string {
    // Dim pipe separator with spaces (matches legacy)
    return style.dim(" | ");
  }
  
  /**
   * Render section items with separators.
   */
  private renderSectionItems(section: Section, ctx: RenderContext): string[] {
    return section.items.map((item) => this.renderItem(item, ctx));
  }
  
  /**
   * Render all sections with section separators.
   */
  private renderSections(layout: SectionLayout, ctx: RenderContext, sectionSeparator: string): string {
    const renderedSections = layout.sections.map((section) => {
      const items = this.renderSectionItems(section, ctx);
      if (items.length === 0) return null;
      
      const itemSeparator = this.getItemSeparator(ctx);
      return this.join(items, itemSeparator);
    }).filter((s): s is string => s !== null);
    
    return this.join(renderedSections, sectionSeparator);
  }
  
  /**
   * Resolve item content to string.
   */
  private resolveContent(item: SectionItem, ctx: RenderContext): string {
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

/** Default CLI renderer instance */
export const cliRenderer = new CliRenderer();