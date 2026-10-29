/**
 * OpenCode Renderer - renders to OpenCode status line format.
 * OpenCode uses a similar component-based approach.
 */

import type { Section, SectionItem, SectionLayout, RenderContext } from "../model.js";
import type { Renderer } from "../renderer.js";

/** OpenCode status line component */
export interface OpenCodeComponent {
  type: "text" | "icon" | "separator";
  content: string;
  style?: "normal" | "bold" | "dim" | "italic" | "underline";
  color?: string;
  bgColor?: string;
}

/** OpenCode Renderer - outputs component array */
export class OpenCodeRenderer implements Renderer<OpenCodeComponent[], OpenCodeComponent> {
  readonly target = "opencode" as const;
  
  render(layout: SectionLayout, ctx: RenderContext): OpenCodeComponent[] {
    const components: OpenCodeComponent[] = [];
    
    for (let i = 0; i < layout.sections.length; i++) {
      const section = layout.sections[i];
      
      for (let j = 0; j < section.items.length; j++) {
        const item = section.items[j];
        const component = this.renderItem(item, ctx);
        if (component) {
          if (j > 0) {
            components.push(this.getItemSeparatorComponent());
          }
          components.push(component);
        }
      }
      
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
  
  renderItem(item: SectionItem, ctx: RenderContext): OpenCodeComponent {
    const content = this.resolveContent(item, ctx);
    
    return {
      type: "text",
      content,
      style: this.getStyle(item.priority),
      color: this.getColor(item.priority),
    };
  }
  
  join(items: OpenCodeComponent[], separator: OpenCodeComponent): OpenCodeComponent[] {
    if (items.length === 0) return [];
    if (items.length === 1) return items;
    
    const result: OpenCodeComponent[] = [items[0]];
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
  
  private getStyle(priority: number): OpenCodeComponent["style"] {
    if (priority >= 100) return "bold";
    if (priority >= 70) return "normal";
    if (priority >= 30) return "normal";
    if (priority >= 10) return "dim";
    return "dim";
  }
  
  private getColor(priority: number): string | undefined {
    if (priority >= 100) return "#ff6b6b";
    if (priority >= 70) return "#ffd93d";
    if (priority >= 30) return "#ffffff";
    if (priority >= 10) return "#a0a0a0";
    return "#606060";
  }
  
  private getItemSeparatorComponent(): OpenCodeComponent {
    return {
      type: "separator",
      content: "│",
      style: "dim",
      color: "#606060",
    };
  }
  
  private getSectionSeparatorComponent(): OpenCodeComponent {
    return {
      type: "separator",
      content: "│",
      style: "dim",
      color: "#808080",
    };
  }
}

/** Default OpenCode renderer instance */
export const opencodeRenderer = new OpenCodeRenderer();