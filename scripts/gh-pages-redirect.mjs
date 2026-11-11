/**
 * Builds the GitHub Pages copy as redirect pages only (run by .github/workflows/pages.yml).
 * Every old kevinsunde.github.io/avoimetportit/... address forwards to the same page on
 * https://avoimetportit.com, so Google moves its results to the real website.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://avoimetportit.com";
// Search Console ownership of kevinsunde.github.io/avoimetportit/ (used for the Removals tool).
const VERIFY = '<meta name="google-site-verification" content="iPNERqIYGWOxgq-uN6fEXucwUbl3ploymvYtJ8kafww">';
const out = join(process.cwd(), "gh-pages-redirect");
mkdirSync(out, { recursive: true });

const page = (target) => `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8">
  ${VERIFY}
  <title>Avoimet portit – avoimetportit.com</title>
  <link rel="canonical" href="${target}">
  <meta http-equiv="refresh" content="0; url=${target}">
  <script>location.replace(${JSON.stringify(target)} + location.hash);</script>
</head>
<body>
  <p>Sivusto on siirtynyt: <a href="${target}">${target}</a></p>
</body>
</html>
`;

const PAGES = {
  "index.html": "/",
  "ajankohtaset.html": "/ajankohtaset",
  "merikaupungin-joulukodit.html": "/merikaupungin-joulukodit",
  "kaytannon-tiedot.html": "/kaytannon-tiedot",
};
for (const [file, path] of Object.entries(PAGES)) writeFileSync(join(out, file), page(SITE + path));

// Any other old address: same path on the real site, without the /repo/ prefix and .html.
writeFileSync(
  join(out, "404.html"),
  `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8">
  ${VERIFY}
  <meta name="robots" content="noindex">
  <title>Avoimet portit – avoimetportit.com</title>
  <script>
    var p = location.pathname.replace(/^\\/avoimetportit/, "").replace(/(index)?\\.html$/, "");
    location.replace(${JSON.stringify(SITE)} + (p || "/") + location.hash);
  </script>
</head>
<body>
  <p><a href="${SITE}/">${SITE}</a></p>
</body>
</html>
`,
);
// Search Console HTML-file verification for the same property.
writeFileSync(join(out, "googlef2328acbf7a39e13.html"), "google-site-verification: googlef2328acbf7a39e13.html");
writeFileSync(join(out, "robots.txt"), "User-agent: *\nAllow: /\n");
console.log(`[gh-pages] redirect pages written to ${out}`);
