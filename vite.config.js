import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ command }) => {
  const repoName = "InventarioSemcas";

  return {
    envDir: projectRoot,
    base: command === "build" ? `/${repoName}/` : "/",
    plugins: [react({ jsxRuntime: "classic" })],
    build: command === "build"
      ? { minify: false, cssMinify: false, reportCompressedSize: false, sourcemap: false }
      : undefined,
    optimizeDeps: {
      noDiscovery: true,
      include: ["react/jsx-runtime", "react/jsx-dev-runtime"],
      exclude: ["xlsx", "xlsx/xlsx.mjs"],
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
