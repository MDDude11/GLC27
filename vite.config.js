import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        programme: resolve(import.meta.dirname, "programme.html"),
        matches: resolve(import.meta.dirname, "matches.html"),
        match: resolve(import.meta.dirname, "match.html"),
        scorer: resolve(import.meta.dirname, "scorer.html"),
        settings: resolve(import.meta.dirname, "settings.html"),
        about: resolve(import.meta.dirname, "about.html")
      }
    }
  }
});
