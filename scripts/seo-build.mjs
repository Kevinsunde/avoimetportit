/**
 * Runs after `vite build` (see package.json "build").
 *
 * - Bakes translated text into every page so search engines see real content.
 * - Creates Swedish (/sv/) and English (/en/) versions of every page.
 * - Adds canonical, hreflang, Open Graph (social sharing) tags and structured data (JSON-LD).
 * - Writes sitemap.xml and robots.txt.
 *
 * Texts come from public/js/main.js (defaults) + public/site-content.json (overrides).
 * Event dates and share images come from site-content.json → "seo".
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const content = JSON.parse(readFileSync(join(dist, "site-content.json"), "utf8"));
const seo = content.seo || {};
const SITE = String(process.env.SITE_URL || seo.siteUrl || "https://avoimetportit.com").replace(/\/+$/, "");

// Same rule as vite.config.js: a GitHub project-page build lives under /repo/ and is only a mirror.
const pagesBase = process.env.GITHUB_PAGES_BASE?.trim();
const isMirrorBuild = Boolean(pagesBase && pagesBase !== "/");

const LANGS = ["fi", "sv", "en"];
const LOCALE = { fi: "fi_FI", sv: "sv_FI", en: "en_GB" };
const BRAND = { fi: "Avoimet portit", sv: "Öppna portar", en: "Open Gates" };
const CITY = { fi: "Kristiinankaupunki", sv: "Kristinestad", en: "Kristinestad" };
const REGION = { fi: "Pohjanmaa", sv: "Österbotten", en: "Ostrobothnia" };

const PAGES = [
  { file: "index.html", id: "home", slug: "" },
  { file: "ajankohtaset.html", id: "ajankohtaset", slug: "ajankohtaset" },
  { file: "merikaupungin-joulukodit.html", id: "joulukodit", slug: "merikaupungin-joulukodit" },
];
const SLUG_BY_FILE = Object.fromEntries(PAGES.map((p) => [p.file, p.slug]));

/* ---------- strings ---------- */

function loadDefaultStrings() {
  const src = readFileSync(join(dist, "js", "main.js"), "utf8");
  const needle = "const DEFAULT_STRINGS = ";
  const i = src.indexOf(needle);
  if (i === -1) throw new Error("DEFAULT_STRINGS not found in main.js");
  let depth = 0;
  let start = -1;
  for (let j = i + needle.length; j < src.length; j++) {
    const c = src[j];
    if (c === "{") {
      if (depth === 0) start = j;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return Function(`"use strict"; return (${src.slice(start, j + 1)})`)();
    }
  }
  throw new Error("Could not parse DEFAULT_STRINGS");
}

const defaults = loadDefaultStrings();
const STRINGS = {};
for (const l of LANGS) STRINGS[l] = { ...(defaults[l] || {}), ...(content.languages?.[l] || {}) };

/* ---------- helpers ---------- */

const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");
const pick = (v, lang) => (v && typeof v === "object" ? v[lang] ?? v.fi ?? "" : v ?? "");

function pagePath(lang, page) {
  return (lang === "fi" ? "/" : `/${lang}/`) + page.slug;
}
const pageUrl = (lang, page) => SITE + pagePath(lang, page);

function titleAndDescription(lang, page) {
  const b = STRINGS[lang];
  if (page.id === "home") {
    const site = content.site || {};
    return {
      title: (lang === "fi" && site.title) || b["home.documentTitle"],
      description: (lang === "fi" && site.description) || b["home.metaDescription"],
    };
  }
  return { title: b[`${page.id}.documentTitle`], description: b[`${page.id}.metaDescription`] };
}

/* ---------- HTML transforms ---------- */

function translate(html, lang) {
  const b = STRINGS[lang];
  // Text-only elements marked with data-i18n="key" (same rule as setLanguage in main.js)
  html = html.replace(
    /<([a-zA-Z][a-zA-Z0-9]*)(\s(?:[^>]*?\s)?data-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (m, tag, attrs, key, inner) => (b[key] ? `<${tag}${attrs}>${escText(b[key])}</${tag}>` : m),
  );
  html = html.replace(/<img\b[^>]*\bdata-i18n-alt="([^"]+)"[^>]*>/g, (tag, key) => {
    if (!b[key]) return tag;
    const alt = `alt="${escAttr(b[key])}"`;
    return /\salt="[^"]*"/.test(tag) ? tag.replace(/\salt="[^"]*"/, ` ${alt}`) : tag.replace(/^<img/, `<img ${alt}`);
  });
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  html = html.replace(
    /class="lang-btn(?: is-active)?" data-lang="(\w+)" aria-pressed="(?:true|false)"/g,
    (m, l) => `class="lang-btn${l === lang ? " is-active" : ""}" data-lang="${l}" aria-pressed="${l === lang}"`,
  );
  return html;
}

function setTitleAndDescription(html, title, description) {
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(title)}</title>`);
  if (description) {
    html = html.replace(/(<meta id="meta-description" name="description" content=")[^"]*(")/, `$1${escAttr(description)}$2`);
  }
  return html;
}

function rewriteLinks(html, lang, page) {
  const prefix = lang === "fi" ? "/" : `/${lang}/`;
  // Internal page links → clean, language-specific URLs (no .html → avoids redirect hops)
  html = html.replace(/href="(index\.html|ajankohtaset\.html|merikaupungin-joulukodit\.html)(#[^"]*)?"/g, (m, file, hash = "") => {
    return `href="${prefix}${SLUG_BY_FILE[file]}${hash}"`;
  });
  if (lang !== "fi") {
    // These pages use <base href="/">, so same-page #anchors need the page path.
    html = html.replace(/href="(#[^"]*)"/g, `href="${pagePath(lang, page)}$1"`);
    // Shared files (images/, js/, vendor/) live at the site root.
    html = html.replace(/<head>/, '<head>\n  <base href="/">');
  }
  return html;
}

/* ---------- structured data ---------- */

function eventLd(ev, lang, page, description, image) {
  const node = {
    "@type": "Event",
    name: pick(ev.name, lang),
    description,
    startDate: ev.startDate,
    endDate: ev.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: pageUrl(lang, page),
    image: [image],
    location: {
      "@type": "Place",
      name: pick(ev.place, lang),
      address: {
        "@type": "PostalAddress",
        ...(ev.streetAddress ? { streetAddress: ev.streetAddress } : {}),
        addressLocality: CITY[lang],
        postalCode: "64100",
        addressRegion: REGION[lang],
        addressCountry: "FI",
      },
      ...(ev.latitude && ev.longitude
        ? { geo: { "@type": "GeoCoordinates", latitude: ev.latitude, longitude: ev.longitude } }
        : {}),
    },
    organizer: { "@type": "Organization", name: BRAND[lang], url: SITE + "/" },
  };
  if (Array.isArray(ev.offers) && ev.offers.length) {
    node.offers = ev.offers.map((o) => ({
      "@type": "Offer",
      name: pick(o.name, lang),
      price: String(o.price),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: pageUrl(lang, page),
    }));
  }
  return node;
}

function structuredData(lang, page, title, description, image) {
  const graph = [];
  const pageSeo = seo.pages?.[page.id] || {};
  if (page.id === "home") {
    graph.push({
      "@type": "WebSite",
      "@id": SITE + "/#website",
      name: BRAND[lang],
      alternateName: LANGS.filter((l) => l !== lang).map((l) => BRAND[l]),
      url: pageUrl(lang, page),
      inLanguage: lang,
    });
    graph.push({
      "@type": "Organization",
      "@id": SITE + "/#organization",
      name: BRAND[lang],
      url: SITE + "/",
      ...(seo.facebook ? { sameAs: [seo.facebook] } : {}),
    });
  } else {
    const home = PAGES[0];
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: BRAND[lang], item: pageUrl(lang, home) },
        { "@type": "ListItem", position: 2, name: title, item: pageUrl(lang, page) },
      ],
    });
  }
  for (const ev of pageSeo.events || []) {
    if (ev && ev.startDate) graph.push(eventLd(ev, lang, page, description, image));
  }
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/* ---------- head tags ---------- */

function headTags(lang, page, title, description) {
  const pageSeo = seo.pages?.[page.id] || {};
  const imageFile = pageSeo.shareImage || seo.shareImage || "og-avoimet-portit.jpg";
  const image = `${SITE}/images/${imageFile}`;
  const url = pageUrl(lang, page);
  const tags = [
    `<link rel="canonical" href="${url}">`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l, page)}">`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl("fi", page)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escAttr(BRAND[lang])}">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="${LOCALE[lang]}">`,
    ...LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALE[l]}">`),
    `<meta name="twitter:card" content="summary_large_image">`,
    structuredData(lang, page, title, description, image),
  ];
  return tags.map((t) => "  " + t.replace(/\n/g, "\n  ")).join("\n");
}

const injectHead = (html, tags) => html.replace(/\s*<\/head>/, `\n${tags}\n</head>`);

/* ---------- build ---------- */

if (isMirrorBuild) {
  // GitHub Pages copy: just point search engines to the real site.
  for (const page of PAGES) {
    const p = join(dist, page.file);
    if (!existsSync(p)) continue;
    const html = readFileSync(p, "utf8");
    writeFileSync(p, injectHead(html, `  <link rel="canonical" href="${pageUrl("fi", page)}">`));
  }
  console.log(`[seo] mirror build: canonical → ${SITE}`);
} else {
  const sources = Object.fromEntries(PAGES.map((p) => [p.file, readFileSync(join(dist, p.file), "utf8")]));
  for (const lang of LANGS) {
    for (const page of PAGES) {
      const { title, description } = titleAndDescription(lang, page);
      let html = translate(sources[page.file], lang);
      html = setTitleAndDescription(html, title, description);
      html = rewriteLinks(html, lang, page);
      html = injectHead(html, headTags(lang, page, title, description));
      const outDir = lang === "fi" ? dist : join(dist, lang);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, page.file), html);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  for (const page of PAGES) {
    for (const lang of LANGS) {
      const alts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l, page)}"/>`);
      alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl("fi", page)}"/>`);
      urls.push(
        `  <url>\n    <loc>${pageUrl(lang, page)}</loc>\n    <lastmod>${today}</lastmod>\n${alts.join("\n")}\n  </url>`,
      );
    }
  }
  writeFileSync(
    join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`,
  );
  writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`[seo] ${PAGES.length * LANGS.length} pages, sitemap.xml and robots.txt written for ${SITE}`);
}
