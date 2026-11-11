# Aquoral Canada · Design System v2 ("Fluid")

v2 is the **type, liquid-glass, motion and component layer**. The **colour source of truth is the root token set** (`../aquoral-tokens.css`, `../aquoral-tokens.json`), which is calibrated to the carton: Tide cobalt, Orchid magenta, Sky, Pearl. v2 defines no colour primitives. It references root names and derives a few tints from them (`abyss`, glass tints, stage light). It also builds on the root motif layer (`../aquoral-components.css`: swirl band, swirl edge, dot, bar, spoke wheel).

Load order on every page:

```html
<link rel="stylesheet" href="design-system/v2/aquoral-tokens.css">     <!-- @imports ../aquoral-tokens.css + fonts -->
<link rel="stylesheet" href="design-system/v2/aquoral-components.css"> <!-- @imports ../aquoral-components.css -->
```

`assets/wordmark.png` (official artwork, used as a mask) must sit beside the components CSS. `specimen.html` shows every token and component in both themes. Add `?theme=dark` to see the dark page. Screens are in `screens/`.

## What changed from v1, and why

- **Bolder, no serif.** Fraunces is gone. Display is **Sora**, a geometric sans with open, rounded forms, set at weights 600–800 with tight tracking. It sits naturally beside the lowercase "aquoral" wordmark, it stays legible at heavy weights, and its moderate width leaves room for the 25% extra length French needs. Unbounded was too wide and Bricolage too quirky. Sora is variable from 300 to 800, so headings can **flow** from thin to bold as they arrive (`.aq-flow`).
- **Fluidity.** The site now has liquid-glass surfaces, a deep-ocean stage for 3D, caustic light as a texture, ripple hotspots, and the root swirl as section masks and bands.
- **Technical schematic.** Geist Mono labels give the 3D bottle its thin-line annotations: dot, leader line, mono label and value.

## Colour (references root)

- **Light is the default: a clean white page** (`surface` = `pearl-0`). Colour arrives as accents. If a screen looks blue overall, take colour away.
- `brand`/`action` = `tide-600` (wordmark cobalt). One primary action per view.
- `accent` = Orchid (`orchid-600` light, `orchid-300` dark). Use it rarely: benefit chips, the "Coming soon" chip, stat bars, the logo dot. **Icons, card tiles, article meta and stat units use `brand`, not Orchid.** Never put more than one Orchid element in competition within a view.
- Sky is light and water: `halo`, `caustic`, the swirl, and in the dark theme `accent-glow` (leader lines, hotspot drop) and the stage primary-button fill. On white pages, Sky never carries text. **The only exception** is `highlight` on the dark stage (`sky-300` on `tide-950`, 11.6:1), used for the highlighted words in a display headline. Get sign-off from the root owner before relying on it.
- **Dark = deep-ocean stage** for 3D sections and the hero: `tide-950` ground fading to `abyss` (derived, never pure black), with a cobalt glow behind the product. Put `data-theme="dark"` on any section. Root sets `:root` dark; v2 also lets the attribute work on any element. To do that, v2 *mirrors* a handful of root's literal dark values (marked `/* mirror */`). Keep them in step if root changes.
- v2 dark overrides root in one place: `action` is `sky-300` (luminous fill, `tide-950` label, 11.6:1). Root dark uses `tide-300`, which looked washed out on the stage.
### No-gradient rule (Dapo, 2026-11-11)

Every colour surface is **one solid token**. Where a gradient used to be, pick the single accent that suits that spot:

- **Highlighted words** in headings: solid `orchid-600` (light) / `orchid-300` (dark) for warm, benefit-led lines; solid `tide-600` (light) / `sky-300` (dark) for factual or brand lines. One highlight colour per heading.
- **Buttons**: solid `action` fill, with `action-hover` on hover. No sheen gradients.
- **Stat numbers, accent bars, chips, icon tiles, play buttons**: solid Orchid or Cobalt, alternating where items repeat.
- **Panels and footers**: a solid surface (`tide-900` navy panel, `sky-50` light panel, white island) plus the swirl motif for texture.
- **Icon chips** (for example the hero fact pills): solid `tide-600` circle with a white icon in both themes. Never a grey or sky-tinted chip on white.

The **only** exception is the hero headline's highlighted word ("Moisture that *stays.*"), which keeps its subtle gradient in both themes because the client asked for it. Do not copy that treatment anywhere else.

Not counted as gradients (allowed): alpha masks that fade an image or video edge, the 3D stage's lighting backdrop and the WebGL/canvas shading inside animations, and textures such as the payment placeholder stripes.

### Contrast (measured, WCAG 2.2 AA)
| Pair | Light | Dark |
|---|---|---|
| ink / surface | 14.8 | 15.7 |
| ink-muted / surface-raised | 7.4 | 7.5 |
| brand / surface | 8.1 | 7.9 |
| accent / surface | 6.9 | 8.2 |
| on-action / action | 8.1 | 11.6 |
| highlight / surface | 8.1 | 11.6 |
| accent-glow (UI) / surface | 5.7 | 11.6 |
| line-strong (UI) / surface | 3.6 | 4.4 |
| ink-muted on dark glass over **white** (worst case) | — | 4.8 |
| ink-muted on light glass over **tide-950** (worst case) | 4.8 | — |

The specimen recomputes these live from computed styles.

## Liquid glass

- Recipe: a tint that passes AA on its own (`glass-tint`: white 80% / tide-950 80%), `backdrop-filter: blur(22px) saturate(180%)`, a 1px border with a brighter top edge (`glass-edge`), an inset top sheen and a soft drop shadow.
- `@supports not (backdrop-filter)` switches to `glass-tint-solid` (96%).
- Use glass for the nav, the secondary button, glass chips, callout tags, hotspot popovers and cards over imagery or 3D. Don't put glass on plain white, where it adds nothing.
- **Caustic light** (`.aq-caustic`, built into `.aq-stage`) is an SVG turbulence mask tinted with `--caustic`. It drifts over 38s and over 160s with reduced motion. It is texture only and never sits behind body text at more than its token opacity.

## Brand motifs (from root)

- **Swirl edge + overlap:** `class="aq-swirl-edge aq-swirl-overlap"` on a section shapes its top with the label's crest and pulls it up over the section above, so dark sections pour in like a wave. Use it on dark bands and the footer.
- **Swirl band** (`motifs/swirl-band.html`): an animated full-bleed band at the foot of a white section, ideally followed by an overlapping swirl-edged section.
- **Dot + bar** open eyebrows: `<p class="aq-eyebrow"><span class="aq-dot"></span><span class="aq-bar"></span>Label</p>`.
- **Spoke wheel:** use it as a marker, as a loader, and as one slow watermark per page (`aq-wheel-watermark`).

## Typography

| Class | Face | Size |
|---|---|---|
| `t-display-xl` | Sora 750 | 46→112, lh .96, −0.045em |
| `t-display-l` | Sora 700 | 40→76 |
| `t-heading-1/2/3/4` | Sora 700/650/600/600 | 34→56 / 28→40 / 25 / 20 |
| `t-stat` | Sora 700 tabular | 52→88 |
| `t-lead`, `t-body`, `t-body-s`, `t-caption` | Atkinson Hyperlegible Next | 19→22, 18, 16, 16 |
| `t-button` | Sora 600 | 17 |
| `t-eyebrow`, `t-label` | Geist Mono 500 caps | 14 (+0.14 / +0.08em) |
| `t-data`, `t-data-l` | Geist Mono 400 tabular, slashed zero | 16, 24 |

- Body is 18px. **No sentence is ever set below 16px**, safety information included. Mono caps at 14px are for short labels only.
- Headings use `text-wrap: balance`. Running text stays near 65ch.

## Layout

- Container is 1400px (the cap for wide layouts is 1320–1480; this overrides root's 1200). The gutter is `clamp(16px, 4vw, 48px)`.
- Section padding is `clamp(64px, 8vw, 128px)`. Use space and the swirl to separate sections, not rules.
- On phones, titles come above the 3D stage. Schematic callouts collapse into a 2-column legend under the product, and hotspot popovers drop below the hotspot.

## Motion

| Token | Value | Use |
|---|---|---|
| `ease-liquid` | `cubic-bezier(.22,1,.36,1)` | entrances, reveals |
| `ease-wave` | `cubic-bezier(.65,0,.35,1)` | loops, crossfades |
| `ease-surface` | `cubic-bezier(.34,1.4,.64,1)` | press, pop, hotspot (surface tension) |
| `ease-drip` | `cubic-bezier(.55,0,.8,.25)` | droplet fall, exits |

Durations: instant 120, fast 180, base 320, slow 640, flow 1100 (heading weight), ripple 2600 (loop), drop 1800, hero 4400.

Patterns:
- `.aq-reveal` + `.is-in` rises 28px with a 6px blur, staggered by `--i` × 70ms.
- `.aq-flow` animates heading weight from 300 to 750.
- `.aq-callout.is-in` draws the leader line, then fades in the tag.

**Reduced motion is gentler, not gone.** It overrides root's 0ms. Fades stay, at 120–400ms. Travel and blur go to 0. The ripple slows to 5.2s and scales less. Heading flow starts at 650. Caustics drift over 160s. Anything the visitor triggers still animates.

## Components (`aq-` prefix)

Layout: `aq-container`, `aq-section`, `aq-grid`, `aq-stage` (dark 3D ground + caustic), `aq-caustic`, `aq-swirl-overlap`.
Glass: `aq-glass`.
Navigation: `aq-announce`, `aq-nav-wrap` > `aq-nav` (`aq-logo` + `aq-wordmark`, `aq-nav-links` with `aria-current`, `aq-nav-end`, `aq-nav-menu`), `aq-lang`.
Buttons: `aq-btn` + `aq-btn-primary` | `aq-btn-glass` | `aq-btn-quiet` | `aq-btn-secondary` (root outline) | `aq-btn-icon`, sizes `aq-btn-sm` / `aq-btn-lg`, `[disabled]`.
Chips: `aq-chip` + `aq-chip-accent` | `aq-chip-neutral` | `aq-chip-warm` | `aq-chip-glass`.
Cards: `aq-card` (+ `aq-glass`, `aq-card-link`), `aq-card-icon`; `aq-article` (`-media`, `-body`, `-meta`).
Data: `aq-stat` (`-value`, `-unit`, `-label`, `-meter`).
Schematic: `aq-schematic` > `aq-schematic-stage` (img) + `aq-callouts` > `aq-callout[data-side]` (`style="--x;--y;--len"`) > `aq-callout-dot`, `aq-callout-line`, `aq-callout-tag` > `aq-callout-label`, `aq-callout-value`.
Hotspot: `aq-hotspot[data-side]` > `button.aq-hotspot-btn[aria-expanded][aria-controls]` + `aq-hotspot-pop`. It is focusable. Toggle `aria-expanded` and close it on Escape.
Disclosure: `aq-accordion` (native `details`/`summary`), `aq-tabs` > `aq-tablist[role=tablist]` > `aq-tab[role=tab]` + `aq-tabpanel` (arrow keys move between tabs).
Content: `aq-steps` > `aq-step` (auto-numbered droplet), `aq-quote` (+ `aq-avatar`).
Forms: `aq-field`, `aq-input`, `aq-select`, `aq-textarea`, `aq-hint`, `aq-error`, `[data-invalid]`, `aq-check`.
Notices: `aq-isi` (`aq-isi-title`), `aq-notice` (checkout placeholder; `-icon`, `-actions`).
Footer: `aq-footer` (`-grid`, `-base`).
Icons and motion: `aq-ic` (sprite `<use>`), `aq-icon`; `aq-reveal`, `aq-flow`, `aq-hl`.
From root: `aq-swirl*`, `aq-swirl-edge`, `aq-dot`, `aq-bar`, `aq-dotlist`, `aq-wheel*`.

## Icons

Lucide outline, 1.75px stroke, 24px, in `brand` on a `surface-tint` tile. Every icon has a visible label.

| Meaning | Icon |
|---|---|
| Dry mouth relief | `droplets` |
| Lubrication | `waves` |
| Moisture-lock film | `layers` |
| Long-lasting | `clock-4` |
| Pocket / travel | `luggage` |
| Sugar-free | `candy-off` (only if the approved label claims it) |
| Speaking | `speech` |
| Eating / swallowing | `utensils` |
| Sleep | `moon-star` |
| Cancer therapy | `ribbon` |
| Sjögren's | `eye` (dry eyes + mouth) |
| Medication side effects | `pill` |
| Ageing | `sunset` |
| Protection | `shield-check` |

Logo-derived marks (dot, bar, spoke wheel) come from the root layer.

### Logo lockup (2026-11-11)

Wherever the wordmark appears (site header, footer), it carries the packaging marks above it, as on the carton: **orchid dot, divider bar, cobalt spoke wheel**, left-aligned over the "a". The site build emits it as `.brand-lockup` (`BRAND_MARKS` + `lockup()` in `site/build.py`). The dot is always `orchid-500` and the wheel `tide-600` with white spokes; the bar follows the wordmark colour, and on dark grounds the wheel gets a thin white rim so it reads against navy. Mark row height is about 38% of the wordmark height. Never use the wordmark without the marks.

## Accessibility

- Target WCAG 2.2 AA. Touch targets are at least 48px and buttons are 52px tall. Focus is a 3px `focus` ring, and inputs also get a 4px glow.
- Status always comes with an icon or a word. The hotspot is a real `<button>` with `aria-expanded`.
- Content and rules from root (bilingual, Canadian spelling, safety block on every claim page) still apply. **No prescription or healthcare-professional content anywhere.**

## Hero compatibility

`hero/index.html` reads `--tide-950/900/600`, `--lagoon-100/300/500` and `--pearl-0/25` at boot. Root still defines these, with `lagoon-*` aliased to `sky-*`. v2 renames nothing, so the hero keeps working when it loads v2.
