# Aquoral Canada

Website and launch assets for Aquoral protective oral spray in Canada.

> **Status: preview, not launch.** Checkout is a placeholder, and several product facts (canister size,
> CAD price, storage and shelf life, Canadian adverse-event contact) still need confirmation before go-live.
> The site sends `X-Robots-Tag: noindex` until then (see `netlify.toml`).

## Layout

| Folder | What it is |
| --- | --- |
| `site/` | The website. `src/pages/**/*.html` are page bodies with a JSON header; `assets/` holds CSS, JS (three.js stage), images, 3D models and How-it-works clips; `build.py` wraps pages in the shared layout. |
| `design-system/` | Colour and type tokens (`aquoral-tokens.css` is the source of truth the site build copies in), components, swirl and spoke-wheel motifs. `v2/` is the liquid-glass layer and specimen page. |
| `hero/` | Stand-alone droplet-to-3D hero prototype (`index.html`); loads models from `../3d-models/`. |
| `3d-models/` | Bottle, box and Canadian carton GLBs, the textures and source pages used to build them, and reference renders. |
| `how-it-works/` | Integration snippet and processing scripts for the How-it-works video loops (the finished clips live in `site/assets/video/`). |

## Build and run locally

Needs Python 3.12 or newer, standard library only.

```bash
python3 site/build.py              # writes the static site to site/dist/
python3 -m http.server -d site/dist 8000
```

Then open http://localhost:8000. Useful query flags on any page with the 3D stage: `?q=low|high`, `?still`, `?debug`, `?review` (outlines claims that still need verifying).

`python3 site/build.py --artifact` is the variant used for the claude.ai artifact preview (inlines the GLBs); you do not need it for Netlify.

## Deploy

Netlify builds from `netlify.toml`: command `python3 site/build.py`, publish directory `site/dist`.

## Not in this repo

Large working media is kept in the project files rather than git: the commercial (masters, raw clips, audio, keyframes), raw Meshy GLBs and renders, How-it-works raw generations and keyframes, and design-system screenshots.
