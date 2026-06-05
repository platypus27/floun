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
    rollupOptions: {
      input: {
        index: "index.html",
        background: "src/extension/background/index.ts",
      },
      output: {
        entryFileNames: ({ name }) => (
          name === "background" ? "background.js" : "assets/[name]-[hash].js"
        ),
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
