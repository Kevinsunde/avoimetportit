/**
 * Tells Bing and other IndexNow search engines about every page in the live sitemap.
 * Run after a deploy that adds or changes pages:  npm run indexnow
 * (Google doesn't use IndexNow; it reads the sitemap via Search Console.)
 */
const SITE = "https://avoimetportit.com";
const KEY = "83634eb33fff52e8fa86016b4fc9964e"; // matches public/<KEY>.txt

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} for ${urlList.length} URLs`);
if (!res.ok) process.exitCode = 1;
