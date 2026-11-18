// Run: node check.js [events.json]
// Verifies the grouping the extension uses, against real or synthetic events.
// ESM, matching the repo's "type": "module".
import fs from "node:fs";
import assert from "node:assert";
import { groupByConversation } from "./group.js";

// Synthetic events covering the cases that matter.
const synthetic = [
  { conversationId: "aaa", chargedCents: 1.5, model: "m1", timestamp: 1000 },
  { conversationId: "aaa", chargedCents: 2.0, model: "m2", timestamp: 2000 },
  { conversationId: "bbb", chargedCents: 4.0, model: "m1", timestamp: 3000 },
  // no conversationId -> bucketed, not dropped
  { chargedCents: 0.5, model: "m3", timestamp: 500 },
  // chargedCents missing -> falls back to tokenUsage.totalCents
  { conversationId: "ccc", tokenUsage: { totalCents: 3.0 }, model: "m1", timestamp: 4000 },
  // chargedCents "-" (dashboard quirk) -> treated as 0, event still counted
  { conversationId: "ddd", chargedCents: "-", tokenUsage: { totalCents: 1.0 }, timestamp: 5000 },
];

const g = groupByConversation(synthetic);
const by = Object.fromEntries(g.map((x) => [x.id, x]));

assert.strictEqual(g.length, 5, "five distinct groups");
assert.strictEqual(by.aaa.cents, 3.5, "aaa sums both events");
assert.strictEqual(by.aaa.events, 2, "aaa counts both events");
assert.deepStrictEqual(by.aaa.models.sort(), ["m1", "m2"], "aaa collects models");
assert.strictEqual(by.aaa.first, 1000, "aaa earliest ts");
assert.strictEqual(by.aaa.last, 2000, "aaa latest ts");
assert.strictEqual(by.bbb.cents, 4.0, "bbb single event");
assert.ok(by["(none)"], "events without conversationId are bucketed, not dropped");
assert.strictEqual(by["(none)"].cents, 0.5, "orphan cost preserved");
assert.strictEqual(by.ccc.cents, 3.0, "falls back to tokenUsage.totalCents");
assert.strictEqual(by.ddd.cents, 0, '"-" chargedCents becomes 0, not NaN');
assert.strictEqual(by.ddd.events, 1, "event with '-' still counted");

// Sorted newest-first by last activity.
assert.deepStrictEqual(
  g.map((x) => x.id),
  ["ddd", "ccc", "bbb", "aaa", "(none)"],
  "sorted by most recent activity"
);

// Total is conserved: grouping never loses or invents money.
const sumGroups = g.reduce((s, x) => s + x.cents, 0);
const sumEvents = synthetic.reduce((s, e) => {
  const c = Number(e.chargedCents ?? (e.tokenUsage && e.tokenUsage.totalCents) ?? 0);
  return s + (Number.isFinite(c) ? c : 0);
}, 0);
assert.strictEqual(sumGroups, sumEvents, "group totals equal event totals");

console.log("synthetic: all assertions passed");

// Optional: run against a real capture from the dashboard endpoint.
const file = process.argv[2];
if (file) {
  const events = JSON.parse(fs.readFileSync(file, "utf8"));
  const real = groupByConversation(events);
  const total = real.reduce((s, x) => s + x.cents, 0);
  console.log(
    `real: ${events.length} events -> ${real.length} conversations, $${(total / 100).toFixed(4)}`
  );
  assert.ok(real.length > 0, "real data produced groups");
  const reSum = real.reduce((s, x) => s + x.events, 0);
  assert.strictEqual(reSum, events.length, "every real event landed in exactly one group");
  console.log("real: all assertions passed");
}
