Aquoral Canada is calm, clinical and quietly premium. It keeps the packaging's own colours, the cobalt wordmark, the magenta dot and the soft sky swirl of the Canadian label, on a clean white page, and uses them with restraint: cobalt Tide carries trust and every action, Orchid magenta appears only in small, deliberate touches, Sky shapes the edges, and white space does the rest. Every screen should feel like relief, not like a promotion.

## Content fundamentals

- Speak to the person living with dry mouth, in the second person: "you", "your mouth". Talk to clinicians separately, in their own section, with clinical terms.
- Sentence case everywhere, including buttons and headings: "Find a pharmacy", not "Find A Pharmacy". Uppercase only in the `label` style.
- Lead with the feeling, then the mechanism, then the evidence. Real lines to model: "Two quick sprays. Up to six hours of relief." · "Forms a protective lipid film that lubricates and holds moisture in."
- Numbers carry units and use an en dash for ranges: "4–6 hours", "2 × 10 mL", "3–4 times a day". Set dosage and licence numbers in `data`.
- Every evidence figure (`stat`) carries a label and a citation marker that links to its source in the footnotes.
- No emoji, no exclamation marks, no "miracle" language. Health claims must match the approved Canadian labelling word for word.
- Canadian spelling in English (colour, centre, labelling). Every string exists in English and French. In French, use « guillemets », a non-breaking space before : ; ! ? and the decimal comma (« 4 à 6 heures »).

## Colour

- Page ground is `surface`; cards and panels sit on `surface-raised`; alternate bands use `surface-sunken`.
- Set all headings and body copy in `ink`. Secondary text and citations use `ink-muted`. Both pass 4.5:1 on all three surfaces in both themes.
- `tide-600` is the wordmark cobalt. It is the primary button (`action` with `on-action` text), links and brand text (`brand`). Use one primary action per view.
- `accent` and `accent-soft` (Orchid) are the magenta, refined from the carton's dot. Use them in small doses: benefit chips, check icons, stat bars, the hero droplet. Never as a button fill, a large background or body text.
- `orchid-500` is the exact brand dot. Reserve it for the dot itself and the hero droplet.
- Status colours (`success`, `warning`, `danger`) always come with a word or an icon, never colour alone.
- `sky-*` and the `swirl-*` tokens are decorative only: the swirl, liquid and 3D highlights. Never set text in Sky.
- The primitive scales (`tide-*`, `sky-*`, `orchid-*`, `pearl-*`) are for illustration, 3D lighting and charts. Build UI from the semantic tokens so the dark theme works for free.
- Keep the old pack's loudness out: no pure electric blue, no full-strength magenta beside full-strength blue, no gradients except the hero stage (`tide-950` fading to `tide-900`), and never more than one Orchid element competing for attention in a view.

## Typography

- Display face is Sora, a geometric sans with open, rounded forms that sit naturally beside the lowercase "aquoral" wordmark. Set it at weight 600 with tight tracking for a confident, modern voice. Use it only for `display-*`, `heading-*` and `stat`. No script or soft serif faces anywhere.
- Text face is Atkinson Hyperlegible Next, designed by the Braille Institute for readers with low vision. Many Aquoral users are older or in cancer treatment, so legibility is a product decision, not a style choice. Use it for all running text, buttons and labels.
- Data face is Geist Mono for dosage, licence numbers, lot codes and small technical labels.
- Body copy is `body` (18px) by default. Never set patient-facing text below 16px.
- Keep running text near 65 characters per line. Headings use `text-wrap: balance`.
- All three families cover French accents. Allow 25% extra length for French and never set text inside images.
- Load from Google Fonts: Sora (400–700), Atkinson Hyperlegible Next (400, 700, italic) and Geist Mono (400, 600), with `display=swap`.

## Spacing and layout

- The page is clean white (`surface`). Colour arrives as accents: cobalt in headings, buttons and links, a magenta dot or chip, and the sky swirl at section edges. If a screen looks blue overall, remove colour.
- Separate sections with space and the swirl, not with rules: `space-8` on mobile, `space-9` on desktop. Alternate white sections with `surface-sunken` bands shaped by SwirlEdge, at most every second section.
- Cards on the white page lift with `shadow-1`; never tint a card to separate it.
- Spacing runs on a 4px base: `space-1` (4px) to `space-10` (144px).
- Side gutters are `space-4` on mobile and `space-6` on desktop. Content sits in a 1200px container on a 12-column grid.
- The hero is the only dark moment on the page: `tide-950` stage with the sky liquid and the magenta droplet.

## Shape and elevation

- Corners: `radius-m` for buttons and controls, `radius-l` for cards and media, `radius-pill` for chips and the language switch.
- Shadows are Tide-tinted. `shadow-1` for resting cards, `shadow-float` only for the 3D product stage and dialogs.

## Brand motifs

- **Swirl:** the layered sky ribbons from the Canadian label. Use SwirlBand as an animated full-bleed band at the foot of a section, and SwirlEdge to shape the top of bands, photos and video. Static SVGs cover email, print and social.
- **Dot and bar:** the logo's magenta dot and cobalt bar open section labels (Eyebrow) and mark benefit lists.
- **Spoke wheel:** the logo's eight-spoke disc serves as a marker, a loader and a slow watermark.
- **Droplet:** the magenta dot becomes the falling droplet in the hero.
- These motifs echo the logo; they never replace it or sit beside it.

## Motion

- Motion should feel like liquid: slow in, settle softly. Use `cubic-bezier(0.22, 1, 0.36, 1)` for entrances.
- Durations: 160ms for hover and focus (`--dur-fast`), 320ms for panels (`--dur-base`), 640ms for section reveals (`--dur-slow`), 1.8s for the droplet fall (`--dur-drop`) and 4.4s for the full droplet-to-bottle hero sequence (`--dur-hero`), which is always skippable.
- Ambient motion is slow and single: one drifting swirl band in view at a time (34–64s loops) and one watermark wheel per page (180s per turn). Pause ambient motion when it is off screen.
- The hero is the one orchestrated moment. Nothing else on the page should compete with it.
- Respect `prefers-reduced-motion`: the hero shows the finished bottle and fades the 3D model in, the swirl stands still, the watermark stops, and the loader ticks instead of spins.

## Imagery and 3D

- Product renders sit on `surface` or on the dark hero stage, lit cool from above with a soft `tide-300` rim light; the magenta dot on the label is the only warm note.
- Photography shows real Canadians in calm, everyday moments: speaking, eating, sleeping. No clinical close-ups of mouths, no stock "pain" faces.
- Use the official packaging artwork from the client's files. Do not redraw the logo or packaging.

## Logo

- The mark is the magenta dot beside the cobalt "aquoral" wordmark, as printed on the carton. Use the official artwork from the client's files and never redraw or recolour it.
- On dark grounds, use a white or `tide-100` wordmark with the `orchid-300` dot, once the client supplies a reversed version.
- Leave clear space equal to the height of the dot on all sides.

## Light and dark themes

Both themes are built in. The tokens in `aquoral-tokens.css` define every semantic colour twice: light values on `:root`, dark values under `prefers-color-scheme: dark` and `html[data-theme="dark"]`. `html[data-theme="light"]` forces light on a dark device. Always use the semantic tokens (`surface`, `ink`, `brand`, `line` and so on), never raw hexes, so a component works in both themes for free.

How the website applies it:

- **Default follows the device.** With no stored choice, `html` has no `data-theme` and the media query decides.
- **A visitor's choice is remembered** in `localStorage` under `aq-theme` (`light` or `dark`). Choosing Auto removes the key.
- **No flash on load.** This must be the first script in `<head>`, before any stylesheet:
  `<script>try{var t=localStorage.getItem('aq-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>`
- **Controls.** The header has a switch (`button.theme-toggle[role=switch][data-theme-toggle]`: sun on a day-sky track, moon on a night track). The phone menu has an Appearance control (`.theme-choice`, Auto / Light / Dark radio group) so a visitor can hand the choice back to their device. Switching spreads the new theme out from the control with a View Transition; under reduced motion it is a short cross-fade. Open tabs stay in sync.
- **White islands in the dark theme.** To keep dark pages from becoming one block of navy, a section marked `data-island` (and every inner-page `.page-hero`) becomes a rounded white panel on the navy page in the dark theme, with the light tokens inside it. In the light theme it is an ordinary section. The home page alternates: How it works (white), Why Aquoral (navy), Institut Pasteur (blue), Everyday relief (white), How to use (navy), Learn (white).
- **3D stage sections** (hero, anatomy, who it helps, order) stay full-bleed and dark in both themes. The Institut Pasteur section is a floating navy panel in both themes (on white in light mode, rim-lit on navy in dark mode).
- **Panel polish.** Panels share `--panel-inset-y`, `--panel-inset-x` and `--panel-radius`. White islands carry a sky rim, a soft halo and the packaging swirl along the bottom edge. Panels rise into place on a scroll-linked animation (`animation-timeline: view()`, ignored where unsupported; fade only under reduced motion).
- **Header placement.** On desktop the switch sits in the bar's top-right corner. At 1080 px and below it moves into the menu's Appearance control, and the bar keeps only the logo, Order and the menu.
- **Header glass** is dark liquid glass over dark grounds and clear light glass over white islands, so it never turns grey.

## Iconography

- Use Lucide outline icons at 1.75px stroke, 24px default size, coloured with `ink` or `accent`. Pair every icon with a visible text label.

## Accessibility

- Target WCAG 2.2 AA, which also covers Ontario's AODA requirements.
- Every text pair in this system meets 4.5:1 in both themes. Control borders (`line-strong`) and the focus ring (`focus`) meet 3:1.
- Focus is always visible: a 3px solid `focus` outline with a 2px offset.
- Touch targets are at least 48 × 48px. Buttons are 52px tall by default.
- Every page offers English and French through the language switch, with `lang` set on the page.

## Canadian market requirements for design

- Bilingual by default. English and French have equal prominence on packaging and on any page aimed at Quebec.
- Replace US-only regulatory content (FDA wording, US patent number, US phone numbers) with the Canadian licence details and contacts once the client confirms them.
- The Important Safety Information block appears on every page that makes a product claim. Use the SafetyInfo component and never shrink it below `body-s`.
