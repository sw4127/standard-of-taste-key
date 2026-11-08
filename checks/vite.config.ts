import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The launch-gate sheet runs on this computer only (npm run gate); it is never built or shipped.
export default defineConfig({
  root: resolve(import.meta.dirname, "gate"),
  plugins: [react()],
  server: { port: 3214, strictPort: true },
});
