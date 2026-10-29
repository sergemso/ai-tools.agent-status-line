/**
 * CLI Renderer - renders to ANSI-colored string for terminal output.
 */

import type { Section, SectionItem, SectionLayout, RenderContext } from "../model.js";
import type { Renderer } from "../renderer.js";
import { colors, style } from "../colors.js";

/** CLI Renderer - outputs ANSI-colored string */
export class CliRenderer implements Renderer<string, string> {
  readonly target = "cli" as const;
  
  /** Color scheme for different section/item types */
  private colorScheme: Record<string, (text: string) => string> = {
    // Section colors
    model: colors.cyan,
    context: colors.green,
    cost: colors.yellow,
    cache: colors.blue,
    "rate-limits": colors.magenta,
    usage: colors.white,
    vim: colors.gray,
    worktree: colors.gray,
    "cursor-extensions": colors.gray,
    
    // Item colors by priority
    critical: colors.bold,
    high: colors.white,
    medium: colors.gray,
    low: colors.dim,
    none: colors.dim,
  };
  
  render(layout: SectionLayout, ctx: RenderContext): string {
    const sectionSeparator = this.getSectionSeparator(ctx);
    return this.renderSections(layout, ctx, sectionSeparator);
  }
  
  measureItem(item: SectionItem, ctx: RenderContext): number {
    const content = this.resolveContent(item, ctx);
    return content.replace(/\x1b\[[0-9;]*m/g, "").length;
  }
  
  renderItem(item: SectionItem, ctx: RenderContext): string {
    let content = this.resolveContent(item, ctx);
    
    // Apply priority-based styling
    const priorityStyle = this.getPriorityStyle(item.priority);
    if (priorityStyle) {
      content = priorityStyle(content);
    }
    
    return content;
  }
  
  join(items: string[], separator: string): string {
    return items.join(separator);
  }
  
  protected getItemSeparator(ctx: RenderContext): string {
    // Dim pipe separator
    return ` ${style.dim("|")} `;
  }
  
  protected getSectionSeparator(ctx: RenderContext): string {
    // Bright dim pipe separator
    return ` ${style.dim("|")} `;
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
  
  /**
   * Get style function based on priority.
   */
  private getPriorityStyle(priority: number): ((text: string) => string) | null {
    if (priority >= 100) return this.colorScheme.critical;
    if (priority >= 70) return this.colorScheme.high;
    if (priority >= 30) return this.colorScheme.medium;
    if (priority >= 10) return this.colorScheme.low;
    return this.colorScheme.none;
  }
}

/** Default CLI renderer instance */
export const cliRenderer = new CliRenderer();