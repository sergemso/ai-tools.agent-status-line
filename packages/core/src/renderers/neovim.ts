/**
 * Neovim Renderer - renders to lualine-compatible component table.
 * Output is a Lua-compatible table structure.
 */

import type { Section, SectionItem, SectionLayout, RenderContext } from "../model.js";
import type { Renderer } from "../renderer.js";

/** Lualine component type */
export type LualineComponent = 
  | string 
  | { 
      [key: string]: any;
      provider?: string | (() => string);
      hl?: string | { fg?: string; bg?: string; gui?: string };
      separator?: string | { left?: string; right?: string };
      padding?: number | { left?: number; right?: number };
    };

/** Neovim Renderer - outputs lualine component array */
export class NeovimRenderer implements Renderer<LualineComponent[], LualineComponent> {
  readonly target = "neovim" as const;
  
  render(layout: SectionLayout, ctx: RenderContext): LualineComponent[] {
    const components: LualineComponent[] = [];
    
    for (let i = 0; i < layout.sections.length; i++) {
      const section = layout.sections[i];
      
      for (let j = 0; j < section.items.length; j++) {
        const item = section.items[j];
        const component = this.renderItem(item, ctx);
        if (component) {
          // Add separator for items after the first in a section
          if (j > 0) {
            components.push(this.getItemSeparatorComponent());
          }
          components.push(component);
        }
      }
      
      // Add section separator
      if (i < layout.sections.length - 1) {
        components.push(this.getSectionSeparatorComponent());
      }
    }
    
    return components;
  }
  
  measureItem(item: SectionItem, ctx: RenderContext): number {
    const content = this.resolveContent(item, ctx);
    return content.length;
  }
  
  renderItem(item: SectionItem, ctx: RenderContext): LualineComponent {
    const content = this.resolveContent(item, ctx);
    
    return {
      provider: content,
      hl: this.getHighlightGroup(item),
      separator: { right: "" },
    };
  }
  
  join(items: LualineComponent[], separator: LualineComponent): LualineComponent[] {
    if (items.length === 0) return [];
    if (items.length === 1) return items;
    
    const result: LualineComponent[] = [items[0]];
    for (let i = 1; i < items.length; i++) {
      result.push(separator);
      result.push(items[i]);
    }
    return result;
  }
  
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
  
  private getHighlightGroup(item: SectionItem): string {
    if (item.priority >= 100) return "StatusLineCritical";
    if (item.priority >= 70) return "StatusLineHigh";
    if (item.priority >= 30) return "StatusLineMedium";
    if (item.priority >= 10) return "StatusLineLow";
    return "StatusLineNone";
  }
  
  private getItemSeparatorComponent(): LualineComponent {
    return {
      provider: "│",
      hl: "StatusLineSeparator",
    };
  }
  
  private getSectionSeparatorComponent(): LualineComponent {
    return {
      provider: "│",
      hl: "StatusLineSectionSeparator",
    };
  }
}

/** Default Neovim renderer instance */
export const neovimRenderer = new NeovimRenderer();