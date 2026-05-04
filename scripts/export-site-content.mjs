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
            { file: "ap-gallery-2023-tapahtuma.jpg", wide: false },
            { file: "ap-gallery-puutalo-2021.jpg", wide: false },
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
            year: "2024",
            images: [
              {
                file: "kristinestad-street-1.jpg",
                caption: {
                  fi: "Avoimet portit 2024 – puutalokatu",
                  sv: "Öppna portar 2024 – trähusgata",
                  en: "Open Gates 2024 – wooden-house street",
                },
              },
              {
                file: "kristinestad-street-2.jpg",
                caption: {
                  fi: "Kesäinen näkymä 2024",
                  sv: "Sommarvy 2024",
                  en: "Summer view 2024",
                },
              },
            ],
          },
          {
            year: "2025",
            images: [
              {
                file: "kristiinankaupunki-ruutukaava.jpg",
                caption: {
                  fi: "Ruutukaava-alue 2025",
                  sv: "Rutnätsstaden 2025",
                  en: "Grid-plan quarter 2025",
                },
              },
              {
                file: "kristinestad-street-1.jpg",
                caption: {
                  fi: "Tapahtumavierailta 2025",
                  sv: "Evenemangsbesök 2025",
                  en: "Event visit 2025",
                },
              },
            ],
          },
          {
            year: "2026",
            images: [
              {
                file: "ap-gallery-2023-tapahtuma.jpg",
                caption: {
                  fi: "Avoimet portit – tunnelmaa 2023",
                  sv: "Öppna portar – stämning 2023",
                  en: "Open Gates – atmosphere in 2023",
                },
              },
              {
                file: "ap-gallery-drone-kristinestad.jpg",
                caption: {
                  fi: "Kristiinankaupunki ilmasta",
                  sv: "Kristinestad från luften",
                  en: "Kristinestad from above",
                },
              },
            ],
          },
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
