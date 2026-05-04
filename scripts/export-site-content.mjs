/**
 * Regenerates public/site-content.json from public/js/main.js DEFAULT_STRINGS.
 * Run: node scripts/export-site-content.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mainPath = join(__dirname, "..", "public", "js", "main.js");
const src = readFileSync(mainPath, "utf8");

const needle = "const DEFAULT_STRINGS = ";
const i = src.indexOf(needle);
if (i === -1) {
  console.error("Could not find DEFAULT_STRINGS in main.js");
  process.exit(1);
}

let depth = 0;
let start = -1;
for (let j = i + needle.length; j < src.length; j++) {
  const c = src[j];
  if (c === "{") {
    if (depth === 0) start = j;
    depth++;
  } else if (c === "}") {
    depth--;
    if (depth === 0 && start !== -1) {
      const objSrc = src.slice(start, j + 1);
      const DEFAULT_STRINGS = Function(`"use strict"; return (${objSrc})`)();
      const payload = {
        _info:
          "Muokkaa vain tätä tiedostoa ja public/images/-kuvia. Älä poista lainausmerkkejä tai pilkkuja vahingossa — käytä JSON-validaattoria. Kehitys: npm run dev. Uudelleenluonti oletuksista: node scripts/export-site-content.mjs",
        images: {
          heroBanner: "avoimet-portit-2026-banner.png",
          hero: "ap-hero-kaptenskans.jpg",
          gallery: [
            { file: "ap-gallery-drone-kristinestad.jpg", wide: true },
            { file: "ap-gallery-2023-tapahtuma.png", wide: false },
            { file: "ap-gallery-puutalo-2021.png", wide: false },
          ],
        },
        site: {
          title: "Avoimet portit – Kristiinankaupunki",
          description:
            "Vuosittainen kulttuuritapahtuma, jossa vanhan puutalokaupungin pihat ja puutarhat avautuvat vierailijoille Kristiinankaupungissa.",
        },
        logo: {
          title: "Avoimet portit",
          subtitle: "Kristiinankaupunki",
        },
        contact: {
          chairName: "Helena Patoranta",
          phoneTel: "+358407402311",
          phoneDisplay: "+358 40 740 2311",
          email: "visit@krs.fi",
          tourismName: "Kristiinankaupungin matkailu",
          addressLine: "Sjögatan 49 / Merikatu 49",
          postalCity: "64100 Kristiinankaupunki",
        },
        links: {
          officialEvent: "https://visitkristinestad.fi/",
          facebook: "https://www.facebook.com/oppnaportar.avoimetportit",
          visitWebsite: "https://visitkristinestad.fi/",
          visitTourismFi: "https://visitkristinestad.fi/fi/",
          programSite: "https://visitkristinestad.fi/upplev/evenemang/oppna-portar/",
          cityCalendar: "https://www.kristinestad.fi/vapaa-aika/tapahtumia",
          visitOpenGatesFi: "https://visitkristinestad.fi/fi/koe/tapahtumia/avoimet-portit/",
          visitOpenGatesEn: "https://visitkristinestad.fi/en/experience/events/open-gates/",
          krsDigiArcMap: "https://krsdigiarc.com/fi/map/",
        },
        prices: {
          day1: "15 €",
          day2: "20 €",
        },
        ajankohtasetByYear: [
          {
            year: "2021–2023",
            images: [
              { file: "ap-aja-01.jpg" },
              { file: "ap-aja-02.jpg" },
              { file: "ap-aja-03.jpg" },
              { file: "ap-aja-04.jpg" },
              { file: "ap-aja-05.jpg" },
              { file: "ap-aja-06.jpg" },
              { file: "ap-aja-07.jpg" },
              { file: "ap-aja-08.jpg" },
              { file: "ap-aja-09.jpg" },
              { file: "ap-aja-10.jpg" },
              { file: "ap-aja-11.jpg" },
              { file: "ap-aja-12.png" },
              { file: "ap-aja-13.png" },
              { file: "ap-aja-14.png" },
              { file: "ap-aja-15.png" },
              { file: "ap-aja-16.jpg" },
              { file: "ap-aja-17.jpg" },
              { file: "ap-aja-18.jpg" },
              { file: "ap-aja-19.jpg" },
              { file: "ap-aja-20.jpg" },
              { file: "ap-aja-21.jpg" },
              { file: "ap-aja-22.jpg" },
              { file: "ap-aja-23.jpg" },
              { file: "ap-aja-24.jpg" },
              { file: "ap-aja-25.jpg" },
              { file: "ap-aja-26.jpg" },
              { file: "ap-aja-27.png" },
              { file: "ap-aja-28.png" },
              { file: "ap-aja-29.png" },
              { file: "ap-aja-30.png" },
              { file: "ap-aja-31.png" },
              { file: "ap-aja-32.png" },
              { file: "ap-aja-33.png" },
              { file: "ap-aja-34.png" },
              { file: "ap-aja-35.png" },
              { file: "ap-aja-36.jpg" },
              { file: "ap-aja-37.jpg" },
              { file: "ap-aja-38.jpg" },
              { file: "ap-aja-39.jpg" },
              { file: "ap-aja-40.jpg" },
            ],
          },
        ],
        languages: DEFAULT_STRINGS,
      };
      const out = join(__dirname, "..", "public", "site-content.json");
      writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
      console.log("Wrote", out);
      process.exit(0);
    }
  }
}

console.error("Unbalanced braces while parsing DEFAULT_STRINGS");
process.exit(1);
