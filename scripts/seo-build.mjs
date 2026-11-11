/**
 * Runs after `vite build` (see package.json "build").
 *
 * - Bakes translated text into every page so search engines see real content.
 * - Creates Swedish (/sv/) and English (/en/) versions of every page.
 * - Adds canonical, hreflang, Open Graph (social sharing) tags and structured data (JSON-LD).
 * - Pre-renders the garden cards and yearly galleries on Ajankohtaiset (using main.js's own render code).
 * - Creates a page per garden spotlight: /kohteet/{slug} (+ /sv/, /en/).
 * - Adds FAQ structured data to the practical info page.
 * - Makes 800px WebP copies of large photos (images/w800/) and adds srcset to lazy images.
 * - Writes sitemap.xml and robots.txt.
 *
 * Texts come from public/js/main.js (defaults) + public/site-content.json (overrides).
 * Event dates and share images come from site-content.json → "seo".
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import sharp from "sharp";

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
  { file: "kaytannon-tiedot.html", id: "info", slug: "kaytannon-tiedot" },
];
const SLUG_BY_FILE = Object.fromEntries(PAGES.map((p) => [p.file, p.slug]));
const AJANKOHTASET = PAGES.find((p) => p.id === "ajankohtaset");

/* ---------- code from main.js ---------- */

const mainSrc = readFileSync(join(dist, "js", "main.js"), "utf8");

/** Source text of `needle` + the balanced {...} or [...] block that follows it in main.js. */
function sliceBlock(needle) {
  const i = mainSrc.indexOf(needle);
  if (i === -1) throw new Error(`"${needle}" not found in main.js`);
  let depth = 0;
  let start = -1;
  for (let j = i + needle.length; j < mainSrc.length; j++) {
    const c = mainSrc[j];
    if (c === "{" || c === "[") {
      if (depth === 0) start = j;
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return { start, text: mainSrc.slice(i, j + 1), body: mainSrc.slice(start, j + 1) };
    }
  }
  throw new Error(`Could not parse "${needle}" in main.js`);
}

const evalBlock = (needle) => Function(`"use strict"; return (${sliceBlock(needle).body})`)();

const defaults = evalBlock("const DEFAULT_STRINGS = ");
const DEFAULT_AJANKOHTASET_BY_YEAR = evalBlock("const DEFAULT_AJANKOHTASET_BY_YEAR = ");

// The page renderers from main.js, run here against a linkedom document so the
// pre-rendered HTML is exactly what the browser would draw.
const RENDER_FNS = [
  "imgPath",
  "currentLangKey",
  "getAjankohtasetByYear",
  "getGardenSpotlights",
  "localizedContent",
  "fillTemplate",
  "yearImageCaption",
  "yearImageAlt",
  "gardenSpotlightHeading",
  "gardenSlug",
  "gardenPageHref",
  "renderGardenSpotlights",
  "renderAjankohtasetYearBlocks",
];
const renderSrc = RENDER_FNS.map((name) => sliceBlock(`function ${name}(`).text).join("\n\n");
const makeRenderer = Function(
  "window",
  "document",
  "STRINGS",
  "lastSiteContentData",
  "DEFAULT_AJANKOHTASET_BY_YEAR",
  `"use strict";\n${renderSrc}\nreturn { ${RENDER_FNS.join(", ")} };`,
);
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

/** Shorten text to a meta description (≈155 chars, cut at a word). */
function clip(text, max = 155) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return s.slice(0, s.lastIndexOf(" ", max - 1)).replace(/[,;:.–-]+$/, "") + "…";
}

function titleAndDescription(lang, page) {
  const b = STRINGS[lang];
  if (page.id === "garden") return page.meta[lang];
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
  html = html.replace(/href="([a-z0-9-]+\.html)(#[^"]*)?"/g, (m, file, hash = "") => {
    if (!(file in SLUG_BY_FILE)) return m;
    return `href="${prefix}${SLUG_BY_FILE[file]}${hash}"`;
  });
  // Garden pages sit one folder deeper (/kohteet/…), so they need <base href="/"> in every language.
  if (lang !== "fi" || page.id === "garden") {
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
    const crumbs = [{ name: BRAND[lang], item: pageUrl(lang, PAGES[0]) }];
    if (page.id === "garden") {
      crumbs.push({ name: STRINGS[lang]["nav.ajankohtaset"], item: pageUrl(lang, AJANKOHTASET) });
      crumbs.push({ name: page.heading[lang], item: pageUrl(lang, page) });
    } else {
      crumbs.push({ name: title, item: pageUrl(lang, page) });
    }
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })),
    });
  }
  if (page.id === "info") {
    const b = STRINGS[lang];
    const qa = [];
    for (let n = 1; b[`info.q${n}`]; n++) {
      if (b[`info.a${n}`]) qa.push({ q: b[`info.q${n}`], a: b[`info.a${n}`] });
    }
    graph.push({
      "@type": "FAQPage",
      mainEntity: qa.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
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
  const ownImage = page.shareImage || pageSeo.shareImage;
  const imageFile = ownImage || seo.shareImage || "og-avoimet-portit.jpg";
  const image = `${SITE}/images/${imageFile}`;
  // Width/height are only known for the default 1200×630 share image.
  const knownSize = !page.shareImage;
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
    ...(knownSize ? [`<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`] : []),
    `<meta property="og:locale" content="${LOCALE[lang]}">`,
    ...LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALE[l]}">`),
    `<meta name="twitter:card" content="summary_large_image">`,
    structuredData(lang, page, title, description, image),
  ];
  return tags.map((t) => "  " + t.replace(/\n/g, "\n  ")).join("\n");
}

const injectHead = (html, tags) => html.replace(/\s*<\/head>/, `\n${tags}\n</head>`);

/* ---------- pre-rendered content ---------- */

/** Garden cards and yearly galleries baked into Ajankohtaiset, so they show (and get indexed) without JS. */
function prerenderAjankohtaset(html, lang) {
  const { window, document } = parseHTML(html);
  document.documentElement.setAttribute("lang", lang);
  window.__AP_BUILD_PAGES = true; // garden headings link to their own pages
  const r = makeRenderer(window, document, STRINGS, content, DEFAULT_AJANKOHTASET_BY_YEAR);
  r.renderGardenSpotlights();
  r.renderAjankohtasetYearBlocks();
  for (const id of ["garden-spotlights-root", "ajankohtaset-years-root"]) {
    document.getElementById(id)?.setAttribute("data-prerendered", lang);
  }
  return document.toString();
}

const gardenPath = (lang, slug) => `${lang === "fi" ? "/" : `/${lang}/`}kohteet/${slug}`;

/** One page per garden spotlight: /kohteet/{slug}, /sv/kohteet/{slug}, /en/kohteet/{slug}. */
function buildGardenPages(gardens, template) {
  const r = makeRenderer({}, null, STRINGS, content, DEFAULT_AJANKOHTASET_BY_YEAR);
  const list = gardens
    .map((entry) => ({ entry, slug: r.gardenSlug(entry) }))
    .filter((g) => g.slug);

  return list.map(({ entry, slug }) => {
    const heading = {};
    const meta = {};
    const source = {};
    for (const lang of LANGS) {
      const b = STRINGS[lang];
      heading[lang] = r.gardenSpotlightHeading(entry, lang);
      const firstBody = r.localizedContent(entry.body, lang).split(/\n\n+/)[0];
      meta[lang] = {
        title: `${heading[lang]} | ${BRAND[lang]} ${CITY[lang]}`,
        description: clip(r.localizedContent(entry.lead, lang) || firstBody || b["ajankohtaset.gardens.dates"]),
      };

      const others = list
        .filter((g) => g.slug !== slug)
        .map((g) => `<li><a href="${gardenPath(lang, g.slug)}">${escText(r.gardenSpotlightHeading(g.entry, lang))}</a></li>`)
        .join("\n            ");

      const { window, document } = parseHTML(template);
      document.documentElement.setAttribute("lang", lang);
      document.body.setAttribute("data-page", "garden");
      document.getElementById("main").innerHTML = `
    <div class="subpage-hero">
      <div class="section-inner">
        <p class="subpage-kicker">${escText(b["ajankohtaset.gardens.kicker"] || "")}</p>
        <h1 class="subpage-title">${escText(heading[lang])}</h1>
        <p class="subpage-back"><a href="ajankohtaset.html#pihaesittelyt">${escText(b["garden.back"] || "")}</a></p>
      </div>
    </div>

    <section class="section section-alt">
      <div class="section-inner">
        <div id="garden-spotlights-root" class="garden-spotlights"></div>
      </div>
    </section>
${
  others
    ? `
    <section class="section">
      <div class="section-inner">
        <div class="prose prose-narrow">
          <h2>${escText(b["garden.othersH2"] || "")}</h2>
          <ul class="link-list">
            ${others}
          </ul>
        </div>
      </div>
    </section>`
    : ""
}
  `;
      // Render the card with main.js's own code, then drop its heading (the page's <h1> has it)
      // and its id, so main.js leaves it alone in the browser.
      makeRenderer(window, document, STRINGS, { gardenSpotlights: [entry] }, []).renderGardenSpotlights();
      const root = document.getElementById("garden-spotlights-root");
      root.querySelector(".garden-spotlight-yard-heading")?.remove();
      root.removeAttribute("id");
      source[lang] = document.toString();
    }

    const firstImage = (entry.images || [])
      .map((im) => (typeof im === "string" ? im : im?.video ? "" : im?.file))
      .find((f) => f && !/^https?:/.test(f) && !/\.(mov|mp4|webm)$/i.test(f));

    return {
      id: "garden",
      file: `kohteet/${slug}.html`,
      slug: `kohteet/${slug}`,
      heading,
      meta,
      source,
      shareImage: firstImage ? r.imgPath(firstImage).replace(/^images\//, "") : "",
    };
  });
}

/* ---------- smaller images ---------- */

const SMALL_WIDTH = 800;

/** Writes an 800px-wide WebP copy of every large photo to dist/images/w800/. Returns name → original width. */
async function makeResponsiveImages() {
  const dir = join(dist, "images");
  const out = join(dir, `w${SMALL_WIDTH}`);
  mkdirSync(out, { recursive: true });
  const made = new Map();
  for (const name of readdirSync(dir)) {
    if (!/\.(jpe?g|png)$/i.test(name) || name.startsWith("og-")) continue;
    try {
      const { width } = await sharp(join(dir, name)).metadata();
      if (!width || width <= SMALL_WIDTH * 1.15) continue;
      await sharp(join(dir, name))
        .resize({ width: SMALL_WIDTH })
        .webp({ quality: 74 })
        .toFile(join(out, name.replace(/\.\w+$/, ".webp")));
      made.set(name, width);
    } catch (err) {
      console.warn(`[seo] could not resize ${name}: ${err.message}`);
    }
  }
  return made;
}

/** Lazy-loaded photos get a srcset, so phones and normal screens load the small copy. */
function addSrcset(html, made) {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    if (/\ssrcset=/.test(tag) || !/\sloading="lazy"/.test(tag)) return tag;
    const m = tag.match(/\ssrc="images\/([^"/]+)"/);
    if (!m || !made.has(m[1])) return tag;
    const small = `images/w${SMALL_WIDTH}/${m[1].replace(/\.\w+$/, ".webp")}`;
    const srcset = `${small} ${SMALL_WIDTH}w, images/${m[1]} ${made.get(m[1])}w`;
    return tag.replace(/^<img/, `<img srcset="${srcset}" sizes="(max-width: 700px) 100vw, 480px"`);
  });
}

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
  const gardens = content.gardenSpotlights || [];
  const gardenPages = buildGardenPages(gardens, sources[AJANKOHTASET.file]);
  const responsive = await makeResponsiveImages();

  for (const lang of LANGS) {
    for (const page of [...PAGES, ...gardenPages]) {
      const { title, description } = titleAndDescription(lang, page);
      let html = page.id === "garden" ? page.source[lang] : sources[page.file];
      if (page.id === "ajankohtaset") html = prerenderAjankohtaset(html, lang, gardens);
      html = translate(html, lang);
      html = setTitleAndDescription(html, title, description);
      html = rewriteLinks(html, lang, page);
      html = injectHead(html, headTags(lang, page, title, description));
      html = addSrcset(html, responsive);
      const outFile = join(lang === "fi" ? dist : join(dist, lang), page.file);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, html);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  for (const page of [...PAGES, ...gardenPages]) {
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
  console.log(
    `[seo] ${(PAGES.length + gardenPages.length) * LANGS.length} pages (${gardenPages.length} garden pages × ${LANGS.length}), ` +
      `${responsive.size} smaller images, sitemap.xml and robots.txt written for ${SITE}`,
  );
}
