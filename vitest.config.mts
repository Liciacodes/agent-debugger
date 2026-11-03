import { defineConfig } from "vitest/config";

// Only our own tests. sample-project has its own config and a test that fails
// on purpose, so it must stay out of this run.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
