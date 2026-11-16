// Language routing for the bilingual site (2026-11-16). English lives at /, Canadian French at /fr/ (same file names).
//
// A visitor arriving from outside the site (no same-site Referer) is sent to the other language when:
//   1. they saved a choice with the EN/FR switch (cookie aq-lang=en|fr), or
//   2. there is no saved choice and their browser ranks French above English (Accept-Language).
// Navigation inside the site is never redirected, so the switch and every link always land where they point.
// Search engine crawlers are never redirected (they read the hreflang alternates instead).
// site/build.py has an inline fallback with the same rules for when this function does not run.
import type { Config, Context } from "@netlify/edge-functions";

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless/i;

function preferred(header: string | null): "en" | "fr" | null {
  if (!header) return null;
  let best: { lang: "en" | "fr"; q: number } | null = null;
  header.split(",").forEach((part, i) => {
    const [tag, ...params] = part.trim().split(";");
    const lang = tag.trim().slice(0, 2).toLowerCase();
    if (lang !== "en" && lang !== "fr") return;
    const qp = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = (qp ? parseFloat(qp.slice(2)) : 1) - i * 1e-6; // ties: earlier in the list wins
    if (!best || q > best.q) best = { lang, q };
  });
  return best ? (best as { lang: "en" | "fr" }).lang : null;
}

export default async (request: Request, context: Context) => {
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const path = url.pathname;
  // pages only: "/", "/x.html", "/folder/x.html" or extensionless pretty URLs
  if (!(path.endsWith("/") || path.endsWith(".html") || !/\.[a-z0-9]+$/i.test(path))) return;
  if (url.searchParams.has("access")) return; // Coming Soon gate unlock links must reach the gate as typed
  if (BOT.test(request.headers.get("user-agent") || "")) return;

  const referer = request.headers.get("referer");
  if (referer) {
    try { if (new URL(referer).host === url.host) return; } catch { /* malformed referer: treat as external */ }
  }

  const isFr = path === "/fr" || path.startsWith("/fr/");
  const current = isFr ? "fr" : "en";
  const saved = context.cookies.get("aq-lang");
  const want = saved === "en" || saved === "fr" ? saved : preferred(request.headers.get("accept-language"));
  if (!want || want === current) return;

  const target = new URL(url);
  target.pathname = want === "fr" ? "/fr" + (path === "/" ? "/" : path) : (path.replace(/^\/fr(?=\/|$)/, "") || "/");
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.pathname + target.search + target.hash,
      "Cache-Control": "private, no-store",
      Vary: "Accept-Language, Cookie, Referer",
    },
  });
};

export const config: Config = {
  path: "/*",
  excludedPath: ["/assets/*", "/api/*", "/.netlify/*", "/favicon.ico", "/robots.txt"],
};
