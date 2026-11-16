#!/usr/bin/env python3
"""Aquoral Canada translation catalog (Canadian French, fr-CA).

How it works
  The English site is the source. build.py renders every English page, then this module cuts the rendered HTML into
  translatable segments (the text of each block element, with inline tags such as <a>, <strong> and icons kept as
  numbered placeholders, plus alt / aria-label / title / placeholder / data-label / data-topic / meta description).
  Each segment is looked up by a hash of its English text in the catalog under site/i18n/fr/*.json, and the French
  page is written to dist/fr/<same path>. A segment with no French entry falls back to English (and is reported).

  Because entries are keyed by the English text, editing English copy makes its old translation "stale" automatically:
  the new text is reported as missing, and the old entry is reported as unused (and offered as a hint).

Commands (run from the repo root or site/)
  python3 site/i18n.py status            Missing / unused counts per page. --strict exits 1 if anything is missing.
  python3 site/i18n.py todo              Write site/i18n/todo/*.json: every missing segment with "fr": "" to fill in,
                                         and the closest old (now unused) translation as a hint when English was edited.
  python3 site/i18n.py check FILE...    Validate filled-in todo files without merging them.
  python3 site/i18n.py merge             Validate filled-in todo files (placeholders, non-empty) and merge into the catalog.
  python3 site/i18n.py prune             Remove unused catalog entries (after merge, once the hints are no longer needed).

Placeholders in a segment: <1>...</1> wraps an inline element (link, bold, span), <2/> stands for a void element
(icon, line break, input). A translation must contain exactly the same placeholders; their order may change.
JS strings: wrap user-visible strings in T('English') in site/assets/js/*.js; they are collected into _js.json and
served to French pages as window.AQ_T. Use {0}, {1} for values: T('Your result, {0}', name).
See site/i18n/README.md for the full workflow and the French style guide.
"""
import difflib, hashlib, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
CAT = HERE / 'i18n' / 'fr'
TODO = HERE / 'i18n' / 'todo'
JS_DIR = HERE / 'assets' / 'js'
SHARED_MIN = 3   # a segment on this many pages or more lives in _shared.json instead of a page file

INLINE = {'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'input', 'kbd', 'mark',
          'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr'}
VOID = {'br', 'img', 'input', 'wbr', 'meta', 'link', 'source', 'hr', 'col', 'area', 'base', 'embed', 'param', 'track'}
ATTRS = ['alt', 'title', 'aria-label', 'placeholder', 'data-label', 'data-topic', 'data-tip']
TOKEN = re.compile(r'<!--.*?-->|<![^>]*>|<(script|style|textarea)\b.*?</\1\s*>|<svg\b.*?</svg\s*>|</?([a-zA-Z][\w-]*)\b[^>]*>', re.S | re.I)
ALPHA = re.compile(r'[A-Za-zÀ-ÿ]{2,}')
PH = re.compile(r'</?\d+/?>')

def key_hash(s):
    return hashlib.sha1(s.encode()).hexdigest()[:12]

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

# ---------------------------------------------------------------- catalog
def load_catalog():
    cat = {}
    for f in sorted(CAT.glob('*.json')) if CAT.exists() else []:
        if f.name == '_js.json': continue
        for h, e in json.loads(f.read_text()).items():
            if e.get('fr'): cat[h] = e
    return cat

def load_js_catalog():
    f = CAT / '_js.json'
    return {e['en']: e['fr'] for e in json.loads(f.read_text()).values() if e.get('fr')} if f.exists() else {}

# ---------------------------------------------------------------- segmenting
def _attrs(tag, tr, found):
    """Translate (or collect) the human-readable attributes of one tag."""
    name = re.match(r'</?([\w-]+)', tag).group(1).lower()
    def sub(m):
        attr, val = m.group(1), m.group(3)
        if attr == 'content' and not (name == 'meta' and re.search(r'name="description"|property="og:(title|description)"', tag)):
            return m.group(0)
        if not ALPHA.search(val) or '{{' in val: return m.group(0)
        k = norm(val)
        if found is not None: found.append(k)
        t = tr(k) if tr else None
        return f'{attr}={m.group(2)}{t}{m.group(2)}' if t else m.group(0)
    names = '|'.join(re.escape(a) for a in ATTRS + ['content'])
    return re.sub(rf'(?<=\s)({names})=(["\'])(.*?)\2', sub, tag, flags=re.S)

def _seg(run):
    """run: list of ('t', text) / ('o'|'c'|'v', tag, name). Returns (lead, key, trail, tags) or None."""
    # placeholder numbering: matched open/close pairs share a number, everything else is void
    pieces, tags, stack = [], {}, []
    n = 0
    for p in run:
        if p[0] == 't': pieces.append(p[1]); continue
        if p[0] == 'o':
            n += 1; stack.append((p[2], n, len(pieces))); pieces.append(None); tags[n] = [p[1], None]; continue
        if p[0] == 'c':
            for i in range(len(stack) - 1, -1, -1):
                if stack[i][0] == p[2]:
                    _, num, idx = stack.pop(i); pieces[idx] = f'<{num}>'; pieces.append(f'</{num}>'); tags[num][1] = p[1]; break
            else:
                n += 1; tags[n] = [p[1], None]; pieces.append(f'<{n}/>')
            continue
        n += 1; tags[n] = [p[1], None]; pieces.append(f'<{n}/>')
    for name, num, idx in stack:   # opened but never closed in this run
        pieces[idx] = f'<{num}/>'
    raw = ''.join(pieces)
    text = PH.sub(' ', raw)
    if not ALPHA.search(re.sub(r'&\w+;', ' ', text)): return None
    # renumber placeholders 1..n in order of appearance so keys stay stable when other markup changes
    order = {}
    def renum(m):
        num = int(re.search(r'\d+', m.group(0)).group(0))
        if num not in order: order[num] = len(order) + 1
        return m.group(0).replace(str(num), str(order[num]))
    raw = PH.sub(renum, raw)
    tags = {order[k]: v for k, v in tags.items() if k in order}
    lead = re.match(r'\s*', raw).group(0); trail = re.search(r'\s*$', raw).group(0)
    return lead, norm(raw), trail, tags

def _fill(fr, tags):
    def rep(m):
        s = m.group(0); num = int(re.search(r'\d+', s).group(0)); t = tags[num]
        return t[1] if s.startswith('</') else t[0]
    return PH.sub(rep, fr)

def placeholders(s):
    return sorted(PH.findall(s))

def _tree(run):
    """Pieces of one inline run -> nodes: ('t', text) | ('v', tag) | ('e', open, [children], close)."""
    root = []; stack = [(None, None, root)]
    for p in run:
        if p[0] == 'o':
            kids = []; stack.append((p[2], p[1], kids)); continue
        if p[0] == 'c' and any(f[0] == p[2] for f in stack[1:]):
            while True:
                name, open_, kids = stack.pop()
                if name == p[2]: stack[-1][2].append(('e', open_, kids, p[1])); break
                stack[-1][2].append(('v', open_)); stack[-1][2].extend(kids)   # unclosed inside: flatten
            continue
        stack[-1][2].append(('t', p[1]) if p[0] == 't' else ('v', p[1]))
    while len(stack) > 1:   # opened but not closed in this run
        name, open_, kids = stack.pop(); stack[-1][2].append(('v', open_)); stack[-1][2].extend(kids)
    return root

def _flat(nodes, out=None):
    out = [] if out is None else out
    for n in nodes:
        if n[0] == 'e':
            name = re.match(r'<([\w-]+)', n[1]).group(1).lower()
            out.append(('o', n[1], name)); _flat(n[2], out); out.append(('c', n[3], name))
        elif n[0] == 't': out.append(n)
        else: out.append(('v', n[1], ''))
    return out

def process(html, tr=None):
    """Walk rendered HTML. With tr (key -> French or None) returns translated HTML; without, returns the list of keys."""
    out, found, run = [], [], []
    def emit(nodes):
        # Only sibling elements (no loose text): translate each element's content on its own, keeping the wrapper
        # tags out of the segment. "<a>How it works</a> <a>Learn</a>" gives two clean segments.
        if all(n[0] != 't' or not n[1].strip() for n in nodes) and any(n[0] == 'e' for n in nodes):
            for n in nodes:
                if n[0] == 'e': out.append(n[1]); emit(n[2]); out.append(n[3])
                else: out.append(n[1])
            return
        pieces = _flat(nodes)
        seg = _seg(pieces)
        if seg:
            lead, key, trail, tags = seg
            found.append(key)
            fr = tr(key) if tr else None
            if fr is not None and placeholders(fr) == placeholders(key):
                out.append(lead + _fill(fr, tags) + trail); return
        out.append(''.join(p[1] for p in pieces))
    def flush():
        if run: emit(_tree(run)); run.clear()
    pos = 0
    for m in TOKEN.finditer(html):
        if m.start() > pos: run.append(('t', html[pos:m.start()]))
        pos = m.end(); tok = m.group(0)
        if tok.startswith('<!') or m.group(1):
            flush(); out.append(tok); continue
        if tok.lower().startswith('<svg'):
            run.append(('v', tok, 'svg')); continue
        name = m.group(2).lower()
        tok = _attrs(tok, tr, None if tr else found)
        if name in INLINE:
            kind = 'c' if tok.startswith('</') else ('v' if name in VOID or tok.endswith('/>') else 'o')
            run.append((kind, tok, name))
        else:
            flush(); out.append(tok)
    if pos < len(html): run.append(('t', html[pos:]))
    flush()
    return ''.join(out) if tr else found

def js_strings():
    keys = []
    for f in sorted(JS_DIR.glob('*.js')):
        if '.bundle.' in f.name or f.name == 'models.js': continue
        for m in re.finditer(r"\bT\(\s*(['\"`])((?:\\.|(?!\1).)*?)\1", f.read_text()):
            s = m.group(2).replace("\\'", "'").replace('\\"', '"')
            if s not in keys: keys.append(s)
    return keys

# ---------------------------------------------------------------- CLI
def english_pages():
    sys.path.insert(0, str(HERE))
    import build
    return list(build.english_pages())   # [(rel, html)]

def page_file(rel):
    return str(rel).replace('/', '__').removesuffix('.html') + '.json'

def survey():
    pages = english_pages()
    occ = {}
    for rel, html in pages:
        for k in process(html):
            occ.setdefault(k, [])
            if str(rel) not in occ[k]: occ[k].append(str(rel))
    return pages, occ

def home(k, occ):
    return '_shared.json' if len(occ[k]) >= SHARED_MIN else page_file(occ[k][0])

def status(strict=False):
    pages, occ = survey()
    cat = load_catalog(); used = set()
    missing = {}
    for k, where in occ.items():
        h = key_hash(k)
        if h in cat: used.add(h)
        else:
            for p in where: missing[p] = missing.get(p, 0) + 1
    jsk = js_strings(); jcat = load_js_catalog()
    js_missing = [s for s in jsk if s not in jcat]
    unused = [h for h in cat if h not in used]
    total = len(occ)
    print(f'{len(pages)} pages, {total} unique segments, {total - len([k for k in occ if key_hash(k) not in cat])} translated')
    for p in sorted(missing): print(f'  missing {missing[p]:4d}  {p}')
    print(f'JS strings: {len(jsk)}, missing {len(js_missing)}')
    print(f'unused catalog entries (stale after an English edit, or removed pages): {len(unused)}')
    n = sum(1 for k in occ if key_hash(k) not in cat) + len(js_missing)
    print('OK: French is complete.' if not n else f'TODO: {n} strings need French. Run: python3 site/i18n.py todo')
    if strict and n: sys.exit(1)

def todo():
    pages, occ = survey()
    cat = load_catalog()
    unused = {h: e for h, e in cat.items() if h not in {key_hash(k) for k in occ}}
    old_en = {e['en']: e for e in unused.values()}
    TODO.mkdir(parents=True, exist_ok=True)
    groups = {}
    for k in occ:
        h = key_hash(k)
        if h in cat: continue
        e = {'en': k, 'fr': '', 'pages': occ[k][:3]}
        near = difflib.get_close_matches(k, old_en.keys(), n=1, cutoff=0.6)
        if near: e['hint_old_en'] = near[0]; e['hint_old_fr'] = old_en[near[0]]['fr']
        groups.setdefault(home(k, occ), {})[h] = e
    jcat = load_js_catalog()
    js = {key_hash(s): {'en': s, 'fr': ''} for s in js_strings() if s not in jcat}
    if js: groups['_js.json'] = js
    for f in TODO.glob('*.json'): f.unlink()
    for name, entries in groups.items():
        (TODO / name).write_text(json.dumps(entries, ensure_ascii=False, indent=1))
    print(f'wrote {sum(len(g) for g in groups.values())} strings in {len(groups)} files to {TODO}')

def merge():
    CAT.mkdir(parents=True, exist_ok=True)
    bad = 0; merged = 0
    for f in sorted(TODO.glob('*.json')):
        entries = json.loads(f.read_text())
        dest = CAT / f.name
        cat = json.loads(dest.read_text()) if dest.exists() else {}
        left = {}
        for h, e in entries.items():
            fr = (e.get('fr') or '').strip()
            if not fr: left[h] = e; continue
            if placeholders(fr) != placeholders(e['en']):
                print(f'  placeholder mismatch in {f.name} {h}: {e["en"][:60]!r}'); bad += 1; left[h] = e; continue
            if h != '_js' and f.name != '_js.json' and key_hash(e['en']) != h:
                print(f'  hash mismatch in {f.name} {h} (English text was edited?)'); bad += 1; left[h] = e; continue
            cat[h] = {'en': e['en'], 'fr': fr}; merged += 1
        dest.write_text(json.dumps(dict(sorted(cat.items())), ensure_ascii=False, indent=1) + '\n')
        if left: f.write_text(json.dumps(left, ensure_ascii=False, indent=1))
        else: f.unlink()
    print(f'merged {merged} strings; {bad} rejected')
    if bad: sys.exit(1)

def check(files):
    """Validate todo files without merging (safe to run while other people edit other todo files)."""
    bad = empty = 0
    for name in files:
        f = pathlib.Path(name)
        if not f.exists(): f = TODO / pathlib.Path(name).name
        for h, e in json.loads(f.read_text()).items():
            fr = (e.get('fr') or '').strip()
            if not fr: empty += 1; print(f'  empty       {f.name} {h}: {e["en"][:70]!r}'); continue
            if placeholders(fr) != placeholders(e['en']):
                bad += 1; print(f'  placeholder {f.name} {h}: en {placeholders(e["en"])} fr {placeholders(fr)}')
    print(f'{empty} empty, {bad} placeholder errors')
    if bad or empty: sys.exit(1)

def prune():
    pages, occ = survey()
    live = {key_hash(k) for k in occ} | {key_hash(s) for s in js_strings()}
    removed = 0
    for f in CAT.glob('*.json'):
        cat = json.loads(f.read_text())
        keep = {h: e for h, e in cat.items() if h in live}
        removed += len(cat) - len(keep)
        if keep: f.write_text(json.dumps(keep, ensure_ascii=False, indent=1) + '\n')
        else: f.unlink()
    print(f'removed {removed} unused entries')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    {'status': lambda: status('--strict' in sys.argv), 'todo': todo, 'merge': merge, 'prune': prune,
     'check': lambda: check(sys.argv[2:])}[cmd]()
