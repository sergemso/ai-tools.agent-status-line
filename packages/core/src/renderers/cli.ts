/**
 * CLI Renderer - renders to ANSI-colored string for terminal output.
 * 
 * This renderer assumes sections provide pre-colored content (matching legacy behavior).
 * It does NOT apply additional priority-based styling.
 */

import type { Section, SectionItem, SectionLayout, RenderContext } from "../model.js";
import type { Renderer } from "../renderer.js";
import { style } from "../colors.js";
import { resolveItemContent, DEFAULT_SECTION_SEPARATOR } from "../layout.js";
import { visibleWidth } from "../width.js";

/** CLI Renderer - outputs ANSI-colored string */
export class CliRenderer implements Renderer<string, string> {
  readonly target = "cli" as const;
  
  render(layout: SectionLayout, ctx: RenderContext): string {
    const sectionSeparator = this.getSectionSeparator(ctx);
    return this.renderSections(layout, ctx, sectionSeparator);
  }
  
  measureItem(item: SectionItem, ctx: RenderContext): number {
    // Use the shared Unicode-aware visibleWidth (CJK / emoji count as 2,
    // combining marks / ZWJ as 0) instead of `string.length`, which
    // under-counts wide glyphs and disagrees with `estimateWidth` in
    // `layout.ts`. Both code paths now share `resolveItemContent` and
    // `visibleWidth` so they can never diverge.
    return visibleWidth(resolveItemContent(item, ctx));
  }
  
  renderItem(item: SectionItem, ctx: RenderContext): string {
    return resolveItemContent(item, ctx);
  }
  
  join(items: string[], separator: string): string {
    return items.join(separator);
  }
  
  protected getItemSeparator(ctx: RenderContext): string {
    // Plain space inside a group (layout budgets 1 column; pipes are for group boundaries)
    return " ";
  }
  
  protected getSectionSeparator(ctx: RenderContext): string {
    // Dim separator; default is the legacy pipe with spaces, user-configurable via sectionSeparator
    return style.dim(ctx.config?.sectionSeparator ?? DEFAULT_SECTION_SEPARATOR);
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
}

/** Default CLI renderer instance */
export const cliRenderer = new CliRenderer();