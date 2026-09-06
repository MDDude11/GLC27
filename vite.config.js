import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        programme: resolve(__dirname, "programme.html"),
        matches: resolve(__dirname, "matches.html"),
        match: resolve(__dirname, "match.html"),
        scorer: resolve(__dirname, "scorer.html"),
        settings: resolve(__dirname, "settings.html"),
        about: resolve(__dirname, "about.html")
      }
    }
  }
});
