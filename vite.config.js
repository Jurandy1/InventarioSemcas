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
    plugins: [react({ jsxRuntime: "classic" })],
    resolve: {
      alias: [
        { find: /^react$/, replacement: path.join(projectRoot, "src/vendor/react-shim.js") },
        { find: /^react-dom\/client$/, replacement: path.join(projectRoot, "src/vendor/react-dom-client-shim.js") },
      ],
    },
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
