/**
 * VS Code Renderer - renders to VS Code StatusBarItem array.
 * Placeholder implementation - requires VS Code API types.
 */

import type { Section, SectionItem, SectionLayout, RenderContext } from "../model.js";
import type { Renderer } from "../renderer.js";

/** VS Code StatusBarItem shape (simplified) */
export interface VSCodeStatusBarItem {
  text: string;
  tooltip?: string;
  color?: string;
  backgroundColor?: string;
  priority?: number;
  alignment?: "left" | "right";
  command?: string;
  accessibilityInformation?: {
    label: string;
    role?: string;
  };
}

/** VS Code Renderer - outputs array of StatusBarItem */
export class VSCodeRenderer implements Renderer<VSCodeStatusBarItem[], VSCodeStatusBarItem> {
  readonly target = "vscode" as const;
  
  render(layout: SectionLayout, ctx: RenderContext): VSCodeStatusBarItem[] {
    const items: VSCodeStatusBarItem[] = [];
    
    for (let i = 0; i < layout.sections.length; i++) {
      const section = layout.sections[i];
      
      for (let j = 0; j < section.items.length; j++) {
        const item = section.items[j];
        const rendered = this.renderItem(item, ctx);
        if (rendered) {
          items.push(rendered);
        }
      }
      
      // Add separator between sections (except last)
      if (i < layout.sections.length - 1) {
        items.push(this.getSectionSeparatorItem());
      }
    }
    
    return items;
  }
  
  measureItem(item: SectionItem, ctx: RenderContext): number {
    const content = this.resolveContent(item, ctx);
    return content.length;
  }
  
  renderItem(item: SectionItem, ctx: RenderContext): VSCodeStatusBarItem {
    const content = this.resolveContent(item, ctx);
    
    return {
      text: content,
      tooltip: this.getTooltip(item, ctx),
      color: this.getItemColor(item),
      priority: this.getItemPriority(item),
    };
  }
  
  join(items: VSCodeStatusBarItem[], separator: VSCodeStatusBarItem): VSCodeStatusBarItem[] {
    if (items.length === 0) return [];
    if (items.length === 1) return items;
    
    const result: VSCodeStatusBarItem[] = [items[0]];
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
  
  private getTooltip(item: SectionItem, ctx: RenderContext): string {
    return `${item.id}: ${this.resolveContent(item, ctx)}`;
  }
  
  private getItemColor(item: SectionItem): string | undefined {
    if (item.priority >= 100) return "var(--statusBarItem.errorBackground)";
    if (item.priority >= 70) return "var(--statusBarItem.warningBackground)";
    return undefined;
  }
  
  private getItemPriority(item: SectionItem): number {
    return 100 - (item.priority / 100) * 50;
  }
  
  private getSectionSeparatorItem(): VSCodeStatusBarItem {
    return {
      text: "$(dash)",
      color: "var(--statusBarItem.remoteBackground)",
    };
  }
}

/** Default VS Code renderer instance */
export const vscodeRenderer = new VSCodeRenderer();