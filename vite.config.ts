import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
    },
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  ssr: {
    // Production: bundle every dependency so the runtime image needs only dist/ and server.mjs.
    noExternal: command === "build" ? true : ["@convex-dev/better-auth"],
  },
}));
