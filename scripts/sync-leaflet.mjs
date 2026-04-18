import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "leaflet", "dist");
const dest = path.join(root, "public", "vendor", "leaflet");

if (!fs.existsSync(src)) {
  console.warn("sync-leaflet: node_modules/leaflet/dist missing (run npm install)");
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.join(dest, "images"), { recursive: true });

fs.copyFileSync(path.join(src, "leaflet.js"), path.join(dest, "leaflet.js"));
fs.copyFileSync(path.join(src, "leaflet.css"), path.join(dest, "leaflet.css"));

const imgDir = path.join(src, "images");
for (const f of fs.readdirSync(imgDir)) {
  if (f.endsWith(".png")) {
    fs.copyFileSync(path.join(imgDir, f), path.join(dest, "images", f));
  }
}

console.log("sync-leaflet: copied leaflet.js, leaflet.css, images/ to public/vendor/leaflet");
