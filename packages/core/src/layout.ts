/**
 * Layout engine - priority-based shrinking algorithm.
 * 
 * Takes sections with items and available width, returns a layout
 * with items fitted according to priority.
 * 
 * First tries to fit all items in section order (legacy behavior).
 * Only applies priority-based shrinking if content overflows.
 */

import type { Section, SectionItem, SectionLayout, RenderContext, Priority } from "./model.js";
import { compositePriority } from "./priority.js";

/** Default separator widths */
const SECTION_SEPARATOR_WIDTH = 3; // " | "
const ITEM_SEPARATOR_WIDTH = 1;    // " "

/**
 * Estimate the rendered width of a section item.
 * Strips ANSI codes and accounts for content type.
 */
export function estimateWidth(item: SectionItem, ctx: RenderContext): number {
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
  const stripped = content.replace(/\x1b\[[0-9;]*m/g, "");
  return stripped.length;
}

/**
 * Calculate total width of sections in section order (legacy behavior).
 */
function calculateSectionOrderWidth(sections: Section[], ctx: RenderContext, availableWidth: number): { width: number; fits: boolean } {
  let width = 0;
  
  // First, compute estimated widths for all items
  const sectionsWithWidth = sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      estimatedWidth: estimateWidth(item, ctx),
    })),
  }));
  
  for (let i = 0; i < sectionsWithWidth.length; i++) {
    const section = sectionsWithWidth[i];
    for (let j = 0; j < section.items.length; j++) {
      width += section.items[j].estimatedWidth;
      if (j > 0) width += ITEM_SEPARATOR_WIDTH;
    }
    if (i > 0 && section.items.length > 0) {
      // Check if any previous section has items
      const prevHasItems = sectionsWithWidth.slice(0, i).some((s) => s.items.length > 0);
      if (prevHasItems) {
        width += SECTION_SEPARATOR_WIDTH;
      }
    }
    
    // Early exit if already over width
    if (width > availableWidth) {
      return { width, fits: false };
    }
  }
  
  return { width, fits: true };
}

/**
 * Build layout by fitting sections/items into available width.
 * First tries section-order fit (legacy behavior), then priority-based shrinking if needed.
 */
export function buildLayout(
  sections: Section[],
  ctx: RenderContext
): SectionLayout {
  const availableWidth = ctx.width;
  const widthConstrained = ctx.widthConstrained ?? true;
  const droppedItems: Array<{ sectionId: string; itemId: string; priority: Priority }> = [];

  // 1. Filter visible sections and items, compute estimated widths
  const visibleSections = sections
    .filter((section) => !section.visibleWhen || section.visibleWhen(ctx))
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.visibleWhen || item.visibleWhen(ctx))
        .map((item) => ({
          ...item,
          estimatedWidth: estimateWidth(item, ctx),
        })),
    }))
    .filter((section) => section.items.length > 0);

  // Calculate total width of all items in section order (for meta)
  const { width: totalWidth, fits: sectionOrderFits } = calculateSectionOrderWidth(visibleSections, ctx, availableWidth);

  // If width is not constrained (legacy auto mode), always use section-order fit
  // If width is constrained but everything fits in section order, use that (legacy behavior)
  if (!widthConstrained || sectionOrderFits) {
    return {
      sections: visibleSections.map(({ items, ...s }) => ({
        ...s,
        items: items.map(({ estimatedWidth, ...item }) => item),
      })),
      meta: {
        totalWidth,
        availableWidth,
        overflow: false,
        droppedItems: [],
      },
    };
  }

  // 2. Otherwise, apply priority-based shrinking
  // Create flat list of all items with composite priority
  const allItems: Array<{
    sectionId: string;
    sectionPriority: Priority;
    item: SectionItem & { estimatedWidth: number };
    compositePriority: number;
  }> = [];

  for (const section of visibleSections) {
    for (const item of section.items) {
      allItems.push({
        sectionId: section.id,
        sectionPriority: section.priority,
        item,
        compositePriority: compositePriority(section.priority, item.priority),
      });
    }
  }

  // 3. Sort by composite priority descending (highest priority first)
  allItems.sort((a, b) => b.compositePriority - a.compositePriority);

  // 4. Greedy fit with critical eviction
  const keptItems = new Set<string>(); // "sectionId:itemId"
  let usedWidth = 0;

  for (const entry of allItems) {
    const { sectionId, item, compositePriority } = entry;
    const itemKey = `${sectionId}:${item.id}`;
    
    // Calculate width needed for this item
    let itemWidth = item.estimatedWidth;
    
    // Count how many items from this section are already kept
    const sectionKeptCount = Array.from(keptItems).filter((k) => k.startsWith(`${sectionId}:`)).length;
    
    // Add item separator if not first item in section
    if (sectionKeptCount > 0) {
      itemWidth += ITEM_SEPARATOR_WIDTH;
    }
    
    // Add section separator if this is the first item of a new section
    // and we already have items from other sections
    const hasOtherSections = Array.from(keptItems).some((k) => !k.startsWith(`${sectionId}:`));
    if (sectionKeptCount === 0 && hasOtherSections) {
      itemWidth += SECTION_SEPARATOR_WIDTH;
    }

    // Check if we have space
    if (usedWidth + itemWidth <= availableWidth) {
      // We have space - keep this item
      keptItems.add(itemKey);
      usedWidth += itemWidth;
    } else {
      // No space - check if this is a CRITICAL item that should evict lower priority
      const isCritical = item.priority >= 100; // CRITICAL = 100
      
      if (isCritical) {
        // Find lowest priority non-critical item to evict
        let evictKey: string | null = null;
        let evictPriority: Priority = 100;
        
        for (const keptKey of keptItems) {
          const [keptSectionId, keptItemId] = keptKey.split(":");
          const keptEntry = allItems.find((e) => e.sectionId === keptSectionId && e.item.id === keptItemId);
          if (keptEntry && keptEntry.item.priority < 100) {
            if (keptEntry.item.priority < evictPriority) {
              evictPriority = keptEntry.item.priority;
              evictKey = keptKey;
            }
          }
        }
        
        if (evictKey) {
          // Evict the candidate
          keptItems.delete(evictKey);
          const [evictSectionId, evictItemId] = evictKey.split(":");
          droppedItems.push({
            sectionId: evictSectionId,
            itemId: evictItemId,
            priority: evictPriority,
          });
          
          // Recalculate usedWidth (simpler: recalc from scratch)
          usedWidth = recalcUsedWidth(keptItems, allItems, availableWidth);
          
          // Now add the critical item
          keptItems.add(itemKey);
          usedWidth = recalcUsedWidth(keptItems, allItems, availableWidth);
        } else {
          // No non-critical item to evict - drop this critical item
          droppedItems.push({
            sectionId,
            itemId: item.id,
            priority: item.priority,
          });
        }
      } else {
        // Non-critical item - drop it
        droppedItems.push({
          sectionId,
          itemId: item.id,
          priority: item.priority,
        });
      }
    }
  }

  // 5. Re-group kept items by section, preserving original section order
  const layoutSections: Section[] = [];
  
  for (const section of visibleSections) {
    const keptSectionItems = section.items.filter((item) => 
      keptItems.has(`${section.id}:${item.id}`)
    );
    
    // Check minItems constraint
    if (section.minItems && keptSectionItems.length < section.minItems) {
      // Need to keep at least minItems - add highest priority missing items
      const sortedItems = [...section.items].sort((a, b) => b.priority - a.priority);
      const minItems = sortedItems.slice(0, section.minItems);
      
      for (const item of minItems) {
        const itemKey = `${section.id}:${item.id}`;
        if (!keptItems.has(itemKey)) {
          keptItems.add(itemKey);
          keptSectionItems.push(item);
        }
      }
    }
    
    if (keptSectionItems.length > 0) {
      layoutSections.push({
        ...section,
        items: keptSectionItems.map(({ estimatedWidth, ...item }) => item),
      });
    }
  }

  return {
    sections: layoutSections,
    meta: {
      totalWidth,
      availableWidth,
      overflow: droppedItems.length > 0,
      droppedItems,
    },
  };
}

/**
 * Recalculate used width from kept items.
 */
function recalcUsedWidth(
  keptItems: Set<string>,
  allItems: Array<{ sectionId: string; item: SectionItem & { estimatedWidth: number } }>,
  availableWidth: number
): number {
  let width = 0;
  const sectionCounts = new Map<string, number>();
  
  // Process in original section order (not priority order)
  const sectionOrder = [...new Set(allItems.map((e) => e.sectionId))];
  
  for (let i = 0; i < sectionOrder.length; i++) {
    const sectionId = sectionOrder[i];
    const sectionItems = allItems.filter((e) => e.sectionId === sectionId);
    
    for (let j = 0; j < sectionItems.length; j++) {
      const itemKey = `${sectionId}:${sectionItems[j].item.id}`;
      if (keptItems.has(itemKey)) {
        width += sectionItems[j].item.estimatedWidth;
        if (j > 0) width += ITEM_SEPARATOR_WIDTH;
        sectionCounts.set(sectionId, (sectionCounts.get(sectionId) ?? 0) + 1);
      }
    }
    
    // Add section separator for subsequent sections that have items
    if (i > 0 && sectionCounts.get(sectionId) && sectionCounts.get(sectionId)! > 0) {
      // Check if any previous section has items
      const prevHasItems = sectionOrder.slice(0, i).some((s) => (sectionCounts.get(s) ?? 0) > 0);
      if (prevHasItems) {
        width += SECTION_SEPARATOR_WIDTH;
      }
    }
  }
  
  return Math.min(width, availableWidth);
}