// Group Cursor usage events by conversationId.
// Shared by the extension's content script and check.js.
export function groupByConversation(events) {
  const map = new Map();
  for (const e of events || []) {
    const id = e.conversationId || "(none)";
    let g = map.get(id);
    if (!g) {
      g = { id, cents: 0, events: 0, models: new Set(), first: Infinity, last: 0 };
      map.set(id, g);
    }
    const cents = Number(
      e.chargedCents ?? (e.tokenUsage && e.tokenUsage.totalCents) ?? 0
    );
    g.cents += Number.isFinite(cents) ? cents : 0;
    g.events += 1;
    if (e.model) g.models.add(e.model);
    const ts = Number(e.timestamp) || 0;
    if (ts) {
      g.first = Math.min(g.first, ts);
      g.last = Math.max(g.last, ts);
    }
  }
  return [...map.values()]
    .map((g) => ({ ...g, models: [...g.models] }))
    .sort((a, b) => b.last - a.last);
}

// Also expose globally so the content script can call it after injection.
if (typeof window !== "undefined") window.groupByConversation = groupByConversation;
