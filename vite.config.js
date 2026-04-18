import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** GitHub project page: /repo-name/ · user site (USER.github.io): set env to / */
let base = "/";
const pagesBase = process.env.GITHUB_PAGES_BASE?.trim();
if (pagesBase && pagesBase !== "/") {
  base = pagesBase.endsWith("/") ? pagesBase : `${pagesBase}/`;
}

export default defineConfig({
  base,
  root: ".",
  publicDir: "public",
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        ajankohtaset: resolve(__dirname, "ajankohtaset.html"),
      },
    },
  },
});
