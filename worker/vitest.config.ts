import { defineConfig } from "vitest/config";
import { configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // Only run tests from source; exclude compiled output (CommonJS in dist breaks Vitest)
    exclude: [...configDefaults.exclude, "**/dist/**"],
  },
});
