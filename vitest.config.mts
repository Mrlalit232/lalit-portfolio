import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname.split(path.sep).join("/");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}/` },
      // `server-only` throws outside Next's react-server condition; neutralise it for unit tests.
      { find: /^server-only$/, replacement: `${root}/tests/stubs/server-only.ts` },
    ],
  },
});
