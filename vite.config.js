import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: "./",
  plugins: [cloudflare()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
