import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      firebaseConfig: path.resolve(root, "src/firebaseConfig.ts"),
      routes: path.resolve(root, "src/routes"),
      features: path.resolve(root, "src/features"),
      shared: path.resolve(root, "src/shared"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "react-query";
          }
          if (id.includes("node_modules/framer-motion")) {
            return "framer-motion";
          }
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }
          if (id.includes("node_modules/@sentry")) {
            return "sentry";
          }
        },
      },
    },
  },
});
