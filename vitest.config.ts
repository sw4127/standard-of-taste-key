import { defineConfig } from "vitest/config";

export default defineConfig({
  // The website's own tsconfig keeps JSX for Next to compile; tests that draw a website page need it compiled here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["core/**/*.test.ts", "core/**/*.test.tsx", "extension/**/*.test.ts", "web/**/*.test.ts", "checks/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/out/**"],
  },
});
