import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envDir: projectRoot,
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
