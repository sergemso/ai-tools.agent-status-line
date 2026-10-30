/**
 * Compile the TUI part with Babel's Solid preset.
 *
 * `tsc` only erases types; it does not implement Solid's fine-grained JSX
 * transform, so JSX expressions would be evaluated once when the element is
 * created instead of becoming reactive getters. OpenCode publishes prebuilt
 * plugins from `node_modules`, where its runtime Solid transform does not run,
 * so the plugin must ship JSX compiled by `babel-preset-solid`.
 *
 * This script replaces the `dist/tui.js` that `tsc` emitted with the same
 * module compiled for Solid. Type declarations still come from `tsc`.
 */

import { readFile, writeFile } from "node:fs/promises";
import babel from "@babel/core";
import solid from "babel-preset-solid";
import typescript from "@babel/preset-typescript";

const source = new URL("../src/tui.tsx", import.meta.url);
const output = new URL("../dist/tui.js", import.meta.url);
const sourceMap = new URL("../dist/tui.js.map", import.meta.url);

const result = await babel.transformAsync(await readFile(source, "utf8"), {
  filename: source.pathname,
  configFile: false,
  babelrc: false,
  sourceMaps: true,
  presets: [
    [solid, { moduleName: "@opentui/solid", generate: "universal" }],
    [typescript],
  ],
});

if (!result?.code) {
  throw new Error("Babel did not produce output for src/tui.tsx");
}

await writeFile(output, `${result.code}\n//# sourceMappingURL=tui.js.map\n`);
await writeFile(sourceMap, JSON.stringify(result.map));
