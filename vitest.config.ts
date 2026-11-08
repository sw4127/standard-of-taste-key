import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["core/**/*.test.ts", "core/**/*.test.tsx", "extension/**/*.test.ts", "web/**/*.test.ts", "checks/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/out/**"],
  },
});
