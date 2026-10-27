import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Build the extension into dist/. Each entry point (popup HTML + content
// script) is emitted with a stable, predictable filename so the manifest can
// reference it reliably.
export default defineConfig({
  // Relative base so emitted asset URLs resolve against the extension root
  // rather than as server-absolute paths.
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        recorder: resolve(__dirname, "src/recorder/index.html"),
        content: resolve(__dirname, "src/content/content.ts"),
        "service-worker": resolve(
          __dirname,
          "src/background/service-worker.ts",
        ),
      },
      output: {
        // Keep the content script and service worker at fixed paths so the
        // manifest can reference them reliably; hash other chunks/assets.
        entryFileNames: (chunk) => {
          if (chunk.name === "content") return "content.js";
          if (chunk.name === "service-worker") return "service-worker.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
