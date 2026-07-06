import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extension/test/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
