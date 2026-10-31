import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts", "packages/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "shared": resolve(__dirname, "src/shared"),
      "utils": resolve(__dirname, "src/utils"),
      "adapters": resolve(__dirname, "src/adapters"),
    },
  },
});