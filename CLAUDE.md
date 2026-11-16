# Working on the Aquoral Canada site

- The site is bilingual. English pages in `site/src/pages/` are the source; Canadian French (`/fr/`) is generated
  from them with the catalog in `site/i18n/fr/`. **Any change to user-visible English text (page copy, layout strings
  in `site/build.py`, alt text, aria-labels, `T('...')` strings in JS) must update the French in the same PR.**
  Follow `site/i18n/README.md`: `python3 site/i18n.py status` → `todo` → translate with the style guide →
  `check` → `merge` → `prune`, until `python3 site/i18n.py status --strict` reports "OK: French is complete."
- New user-visible strings in JavaScript go through `T('English')` so French pages can replace them.
- Keep form `value`s in English (submissions and the database compare across languages).
- Every site change goes to a deploy preview first, with phone screenshots (English and French), and reaches
  production only after Dapo approves.
