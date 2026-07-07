import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ command }) => {
  const repoName = "InventarioSemcas";
  const baseOverride = String(process.env.VITE_BASE || "").trim();
  // Só GitHub Pages usa subpath; Vercel/Netlify também setam CI=true — não usar CI aqui.
  const isGitHubPages = Boolean(process.env.GITHUB_ACTIONS);

  return {
    envDir: projectRoot,
    base: baseOverride || (command === "build" ? (isGitHubPages ? `/${repoName}/` : "/") : "/"),
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
