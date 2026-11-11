// Cloudflare Pages Function: runs before every request.
// Sends www.avoimetportit.com to the main address (301), so search engines see one site
// instead of two copies. Other hostnames (like *.pages.dev previews) are left alone.
const MAIN_HOST = "avoimetportit.com";

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === `www.${MAIN_HOST}`) {
    url.hostname = MAIN_HOST;
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
