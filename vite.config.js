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

/** GitHub Pages: URL without trailing slash makes relative vendor/, js/, images/ resolve wrong; <base> fixes it */
function injectPagesBaseTag() {
  return {
    name: "inject-pages-base-tag",
    transformIndexHtml(html) {
      if (base === "/") return html;
      const href = base.endsWith("/") ? base : `${base}/`;
      return html.replace(/<head[^>]*>/i, (tag) => `${tag}\n  <base href="${href}">`);
    },
  };
}

export default defineConfig({
  base,
  plugins: [injectPagesBaseTag()],
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
        joulukodit: resolve(__dirname, "merikaupungin-joulukodit.html"),
      },
    },
  },
});
