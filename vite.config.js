import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const repoName = "InventarioSemcas";

  return {
    envDir: projectRoot,
    base: command === "build" ? `/${repoName}/` : "/",
    plugins: [react()],
    build: command === "build"
      ? { minify: false, cssMinify: false, reportCompressedSize: false, sourcemap: false }
      : undefined,
    server: {
      host: true,
      port: 5173,
    },
  };
});
