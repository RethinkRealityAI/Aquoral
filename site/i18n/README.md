# French (fr-CA) translation workflow

The site is bilingual: English at `/`, Canadian French at `/fr/` with the same file names
(`/how-it-works.html` ↔ `/fr/how-it-works.html`). English pages in `site/src/pages/` are the only source.
French pages are generated at build time from the English render plus the catalog in `site/i18n/fr/*.json`.

**Rule for every site change:** if you add or edit any user-visible English text (page copy, the layout in
`build.py`, alt text, aria-labels, or `T('...')` strings in JS), update the French in the same pull request:

```sh
python3 site/i18n.py status          # what is missing, per page
python3 site/i18n.py todo            # writes site/i18n/todo/*.json, one file per page (+ _shared.json, _js.json)
#   fill in every "fr": "" (follow the style guide below; "hint_old_fr" is the old translation when English was edited)
python3 site/i18n.py check site/i18n/todo/*.json   # placeholders + empties
python3 site/i18n.py merge           # moves the French into site/i18n/fr/ and deletes the todo files
python3 site/i18n.py prune           # drops translations whose English no longer exists
python3 site/i18n.py status --strict # must end with "OK: French is complete."
```

Then build (`python3 site/build.py`) and look at the French page at phone width before opening the PR.
The build never fails on missing French: untranslated strings show in English and the build prints a count.
`site/i18n/todo/` is scratch space and is not committed.

## How the catalog works

- `i18n.py` cuts each rendered English page into segments: the text of each block element, with inline markup
  replaced by numbered placeholders. `<1>…</1>` wraps a link, bold or span; `<2/>` is an icon, line break or input.
  A translation must keep exactly the same placeholders (order may change to fit French word order).
- Attributes are translated too: `alt`, `title`, `aria-label`, `placeholder`, `data-label`, `data-topic`, and the
  meta description. Form `value`s stay in English on purpose (submissions and the database stay comparable).
- Entries are keyed by a hash of the English text, so any English edit makes the old translation stale
  automatically: the new text shows as missing and `todo` offers the old French as a hint.
- JS strings: wrap user-visible text in `T('English')` (helper defined at the top of `site.js`, `assessment.js`,
  `stage.js`). Use `{0}` for values: `T('Your result, {0}', name)`. French pages receive the strings as `window.AQ_T`.
- A string used on 3+ pages (header, footer, safety box) lives in `_shared.json`; others in the page's own file.

## Language detection and the switch

- `netlify/edge-functions/lang.ts` redirects a first visit (arriving from outside the site, no saved choice) to the
  French page when the browser prefers French over English (`Accept-Language`). Bots are never redirected.
- A saved choice wins: the EN/FR switch (header pill and the Language control in the mobile menu) sets the
  `aq-lang` cookie for a year. Clicking links inside the site never redirects, so the switch always works.
- An inline script in `<head>` applies the same rule if the edge function did not run (local preview, cached page).
- Every page has `<html lang>`, a canonical URL and `hreflang` alternates (`en-CA`, `fr-CA`, `x-default` = English).

## French style guide (Canadian French, health product)

Audience: Canadian consumers (largely Quebec). Use clear, warm, plain French; address the reader as **vous**.
This is a health product: translate faithfully, never add, strengthen or drop a claim, and keep every hedge
(*may* → *peut*, *can help* → *peut aider*). Keep regulatory notes and disclaimers complete.

**Official label wording (bilingual box, use exactly):**

| English | French |
| --- | --- |
| artificial saliva | salive artificielle |
| Product Information | Renseignements sur le produit |
| Indications | Indications |
| Directions for use | Mode d'emploi |
| Shake gently. Remove cap. | Bien agiter. Retirer le capuchon. |
| Precautions | Précautions |
| Read package insert carefully before using this product. | Lire attentivement la notice d'emballage avant d'utiliser ce produit. |
| Avoid contact with eyes. | Éviter tout contact avec les yeux. |
| If irritation occurs, discontinue use and consult a healthcare professional. | En cas d'irritation, cesser l'utilisation et consulter un professionnel de la santé. |
| Keep out of reach of children. | Garder hors de la portée des enfants. |
| Ingredients: Glycerol, water, xylitol, silicon dioxide, aspartame and natural flavoring | Ingrédients : Glycérol, eau, xylitol, dioxyde de silicium, aspartame et arôme naturel |
| Storage and use | Conservation et utilisation |
| Store at room temperature (15 °C–25 °C). Do not freeze. | Conserver à la température ambiante (15 °C à 25 °C). Ne pas congeler. |
| Disposal | Mise au rebut |
| Contact a pharmacist for proper disposal of unused product. | Consulter un pharmacien pour la mise au rebut appropriée du produit non utilisé. |
| Customer information | Renseignements pour les clients |
| relief from chronic and temporary symptoms of dry mouth (xerostomia) | soulager les symptômes de la bouche sèche (xérostomie) chronique et temporaire |

**Glossary**

| English | French |
| --- | --- |
| Aquoral, Aquoral Canada, OGT, Institut Pasteur | unchanged |
| Aquoral Protective Oral Spray / protective oral spray | vaporisateur buccal protecteur Aquoral / vaporisateur buccal protecteur |
| dry mouth / xerostomia | bouche sèche / xérostomie |
| hyposalivation | hyposalivation |
| saliva, salivary glands | salive, glandes salivaires |
| spray (one puff) / 2 sprays / to spray | vaporisation / 2 vaporisations / vaporiser |
| canister | cartouche |
| box | boîte |
| lipid film / protective film | film lipidique / film protecteur |
| moisturize, moisture | hydrater, hydratation (humidité for the air/room) |
| healthcare professional / health professional | professionnel de la santé |
| pharmacist, dentist, doctor | pharmacien, dentiste, médecin |
| No prescription needed | Sans ordonnance (sentence: « Aucune ordonnance n'est requise au Canada. ») |
| medication(s) | médicament(s) |
| Sjögren's (syndrome) | syndrome de Sjögren |
| CPAP / PAP therapy / sleep apnea | PPC (CPAP) on first mention, then PPC / thérapie par pression positive / apnée du sommeil |
| cancer treatment, radiation therapy, chemotherapy | traitement du cancer, radiothérapie, chimiothérapie |
| dentures | prothèses dentaires |
| gluten free | sans gluten |
| How it works / Who it helps / How to use / Learn / FAQ | Fonctionnement / Pour qui / Mode d'emploi / S'informer / FAQ |
| Order, Order Aquoral | Commander, Commander Aquoral |
| checkout, cart, shipping, subscription | paiement, panier, livraison, abonnement |
| Free dry mouth assessment | Évaluation gratuite de la bouche sèche |
| Important safety information | Renseignements importants sur l'innocuité |
| Contact, Privacy, Terms | Nous joindre, Confidentialité, Conditions d'utilisation |
| email | courriel |

**Typography (OQLF):** non-breaking space (U+00A0) before `:` and inside « guillemets », before `$` and `%`;
no space before `;` `!` `?`. Decimal comma (`4,5`), prices `49,99 $`, `10 mL`, `15 °C`, times `4 à 6 heures`.
Typographic apostrophe `’` as in the English source. Sentence case for headings. Keep proper names of
organizations, studies and citations (journal titles, authors) in their original language; translate the visible
link text around them. Keep US drug brand names. Keep HTML entities (`&amp;`, `&nbsp;`) as they are.
