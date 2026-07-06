import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extension/test/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["extension/src/**/*.ts"],
      reporter: ["text", "html"]
    }
  }
});
