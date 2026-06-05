import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  envPrefix: ["VITE_", "REACT_APP_"],
  plugins: [react()],
  build: {
    outDir: "build",
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
