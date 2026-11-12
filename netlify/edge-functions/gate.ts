/* Coming Soon gate (2026-11-11). The client wants the site hidden until launch.

   Every URL serves the Coming Soon page (hero scene only) unless the visitor holds the preview cookie.
     Unlock:  any URL + ?access=<SITE_ACCESS_KEY>   sets a 180-day cookie, then redirects to the clean URL
     Lock:    any URL + ?access=lock                clears the cookie
   Locked visitors can only load the few assets the Coming Soon page needs; every other asset and /api/* answers 403.

   Netlify environment variables (Functions scope; a change needs a new deploy):
     SITE_ACCESS_KEY  the secret preview key. If it is missing nobody can unlock (fails closed).
     SITE_GATE        set to "off" at launch to open the site. Or delete this file.

   Caching: aquoralspray.ca sits behind Cloudflare. Gated responses and every unlocked page or non-public asset are
   sent "private, no-store", so neither Cloudflare nor Netlify can hand the full site to a locked visitor (or the
   Coming Soon page to an unlocked one). */
import type { Config, Context } from "@netlify/edge-functions";
import COMING_SOON from "../generated/coming-soon.js";

const COOKIE = "aq_preview";
const MAX_AGE = 60 * 60 * 24 * 180;
/* What the Coming Soon page itself loads (identical for everyone, so these stay cacheable). */
const PUBLIC = [/^\/assets\/css\/(tokens|site|coming-soon)\.css$/, /^\/assets\/js\/stage\.js$/, /^\/assets\/models\/(bottle|box)\.glb$/, /^\/assets\/img\/[\w.-]+$/];
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store", "Vary": "Cookie" };
const SECURITY = { "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" };

async function token(key: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`aquoral-preview:${key}`));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function cleanRedirect(url: URL, cookie: string) {
  url.searchParams.delete("access");
  return new Response(null, { status: 302, headers: { Location: url.pathname + url.search + url.hash, "Set-Cookie": cookie, ...NO_STORE, ...SECURITY } });
}

export default async (req: Request, context: Context) => {
  if ((Netlify.env.get("SITE_GATE") || "").toLowerCase() === "off") return;   // launched: gate open
  const url = new URL(req.url), path = url.pathname;
  const key = Netlify.env.get("SITE_ACCESS_KEY") || "";
  const good = key ? await token(key) : null;

  const access = url.searchParams.get("access");
  if (access !== null) {
    if (access === "lock") return cleanRedirect(url, `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    if (good && access === key) return cleanRedirect(url, `${COOKIE}=${good}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
    url.searchParams.delete("access");   // wrong key: fall through to the Coming Soon page, no hint
  }

  const unlocked = !!good && context.cookies.get(COOKIE) === good;
  if (unlocked) {
    const res = await context.next();
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
    if (!PUBLIC.some(r => r.test(path))) for (const [k, v] of Object.entries(NO_STORE)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }

  if (PUBLIC.some(r => r.test(path))) return;   // assets the Coming Soon page needs
  if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE, ...SECURITY } });
  if (path.startsWith("/assets/") || path.startsWith("/api/") || path.startsWith("/.netlify/") || req.method !== "GET" && req.method !== "HEAD")
    return new Response("Not available yet", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE, ...SECURITY } });
  return new Response(req.method === "HEAD" ? null : COMING_SOON, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE, ...SECURITY } });
};

export const config: Config = { path: "/*", onError: "/coming-soon.html" };
