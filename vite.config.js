import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ command }) => {
  const repoName = "InventarioSemcas";
  const baseOverride = String(process.env.VITE_BASE || "").trim();
  const isCI = Boolean(process.env.GITHUB_ACTIONS || process.env.CI);

  return {
    envDir: projectRoot,
    base: baseOverride || (command === "build" ? (isCI ? `/${repoName}/` : "/") : "/"),
    plugins: [react({ jsxRuntime: "classic" })],
    build:
      command === "build"
        ? {
            minify: "esbuild",
            cssMinify: true,
            sourcemap: false,
            rollupOptions: {
              output: {
                manualChunks(id) {
                  if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "react-vendor";
                  if (id.includes("node_modules/xlsx")) return "xlsx";
                },
              },
            },
          }
        : undefined,
    optimizeDeps: {
      noDiscovery: true,
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      exclude: ["xlsx", "xlsx/xlsx.mjs"],
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
