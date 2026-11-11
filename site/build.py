#!/usr/bin/env python3
"""Aquoral Canada site builder.
Pages live in src/pages/**/*.html. Each starts with a JSON header in an HTML comment:
  <!--{"title": "...", "description": "...", "nav": "how", "stage": true, "theme": "dark"}-->
followed by the page body (sections). The layout (head, header, footer, safety info) wraps it.
Placeholders: {{icon:name}} inline Lucide-style icons, {{base}} relative root ("" or "../").

  python3 build.py            -> dist/ (static site, loads models from assets/models/*.glb)
  python3 build.py --artifact -> dist/ plus assets/js/models.js with the GLBs inlined as base64
                                 (artifact hosting does not serve .glb)
"""
import base64, hashlib, json, pathlib, re, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC, DIST = HERE / 'src', HERE / 'dist'
DS = HERE.parent / 'design-system'
ARTIFACT = '--artifact' in sys.argv

ICONS = {
  'droplet': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  'droplets': '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'speak': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
  'utensils': '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 3 2h3Zm0 0v7"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'pill': '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  'ribbon': '<path d="M12 11.22C11 9.997 10 9 10 8a2 2 0 0 1 4 0c0 1-.998 2.002-2.01 3.22"/><path d="m12 18 2.57-3.5"/><path d="M6.243 9.016a7 7 0 0 1 11.507-.009"/><path d="M9.35 14.53 12 11.22"/><path d="M9.35 14.53C7.728 12.246 6 10.221 6 7a6 5 0 0 1 12 0c-.005 3.22-1.778 5.235-3.43 7.5l3.557 4.527a1 1 0 0 1-.203 1.43l-1.894 1.36a1 1 0 0 1-1.384-.215L12 18l-2.679 3.593a1 1 0 0 1-1.39.213l-1.865-1.353a1 1 0 0 1-.203-1.422z"/>',
  'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  'wind': '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'activity': '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  'layers': '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'package': '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
  'truck': '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'phone': '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'book': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  'smile': '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  'briefcase': '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  'spray': '<path d="M3 3h.01M7 5h.01M11 7h.01M3 7h.01M7 9h.01M3 11h.01"/><rect width="4" height="4" x="15" y="5"/><path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2"/><path d="m13 14 8-2M13 19l8-2"/>',
  'refresh': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  'thermometer': '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  'cpap': '<path d="M5 9a7 7 0 0 1 14 0v3a7 7 0 0 1-14 0Z"/><path d="M9 11h6"/><path d="M12 19v3"/><path d="M5 10H2M22 10h-3"/>',
}
def cause_icon(name):
    '''Coloured cause icons shared with the commercial (assets/icons/causes/*.svg, inlined).'''
    svg = (HERE / 'assets' / 'icons' / 'causes' / f'{name}.svg').read_text().strip()
    return svg.replace('<svg ', '<svg class="cause-icon" aria-hidden="true" focusable="false" ', 1)

def icon(name, cls='icon'):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'

NAV = [('how', 'How it works', 'how-it-works.html'), ('who', 'Who it helps', 'dry-mouth.html'), ('use', 'How to use', 'how-to-use.html'),
       ('learn', 'Learn', 'learn.html'), ('faq', 'FAQ', 'faq.html')]

# Light / dark theme (2026-11-11). Default follows the device; a choice is kept in localStorage('aq-theme')
# and applied by the inline <head> script before CSS loads, so the page never flashes the wrong theme.
SUN = '<svg class="tt-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>'
MOON = '<svg class="tt-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11Z"/></svg>'
THEME_SWITCH = ('<button class="theme-toggle" type="button" role="switch" aria-checked="false" aria-label="Dark mode" data-theme-toggle>'
                f'<span class="tt-track" aria-hidden="true"><span class="tt-stars"></span><span class="tt-thumb">{SUN}{MOON}</span></span></button>')
THEME_CHOICE = ('<div class="theme-choice" role="radiogroup" aria-label="Appearance"><span class="tc-label" aria-hidden="true">Appearance</span><div class="tc-seg">'
                + ''.join(f'<button type="button" role="radio" aria-checked="false" data-theme-set="{v}">{l}</button>' for v, l in [('system', 'Auto'), ('light', 'Light'), ('dark', 'Dark')])
                + '<span class="tc-pill" aria-hidden="true"></span></div></div>')

def layout(meta, body, base):
    nav_links = ''.join(f'<li><a href="{base}{href}"{" aria-current=\"page\"" if meta.get("nav") == key else ""}>{label}</a></li>' for key, label, href in NAV)
    mobile_links = ''.join(f'<li><a href="{base}{href}">{label}</a></li>' for key, label, href in NAV) + f'<li><a href="{base}assessment.html">Free assessment</a></li><li><a href="{base}order.html">Order Aquoral</a></li><li><a href="{base}contact.html">Contact</a></li>'
    stage = meta.get('stage')
    models = f'<script src="{base}assets/js/models.js"></script>' if (stage and ARTIFACT) else ''
    stage_html = ('<div class="stage-poster" aria-hidden="true"><span class="loader"></span></div>'
                  '<canvas id="stage" aria-hidden="true"></canvas><svg id="leaders" aria-hidden="true"></svg>') if stage else ''
    stage_js = f'<script type="module" src="{base}assets/js/stage.js"></script>' if stage else ''
    # Inner-page hero: liquid-glass panel with a real-time 3D droplet (assets/js/drop.js, css/page-hero.css)
    page_hero = 'class="page-hero' in body
    if page_hero:
        body = re.sub(r'(<section class="page-hero"[^>]*>)', r'\1<div class="ph-fx" aria-hidden="true"><canvas></canvas></div><div class="ph-anchor" aria-hidden="true"></div>', body, count=1)
    hero_css = f'<link rel="stylesheet" href="{base}assets/css/page-hero.css">' if page_hero else ''
    hero_js = f'<script type="module" src="{base}assets/js/drop.js"></script>' if page_hero else ''
    return f'''<!doctype html>
<html lang="en-CA" class="no-js">
<head>
<script>try{{var t=localStorage.getItem('aq-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}</script>
<script type="importmap">{{"imports":{{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}}}</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{meta["title"]}</title>
<meta name="description" content="{meta.get("description", "")}">
<meta name="aq-base" content="{base}">
<meta name="theme-color" content="#0B1833">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{base}assets/css/tokens.css">
<link rel="stylesheet" href="{base}assets/css/site.css">
{hero_css}
{models}
</head>
<body class="{"has-stage" if stage else ""} {meta.get("bodyClass", "")}">
<script>document.documentElement.classList.replace('no-js','js')</script>
<a class="skip-link" href="#main">Skip to content</a>
{stage_html}
<header class="site-header" id="top">
  <div class="bar">
    <a class="brand" href="{base}index.html" aria-label="Aquoral home"><span class="wordmark" role="img" aria-label="Aquoral"></span></a>
    <ul class="nav-links">{nav_links}</ul>
    <div class="nav-end">
      <a class="btn btn-primary btn-sm nav-order" href="{base}order.html">Order {icon("arrow-right")}</a>
      <button class="btn btn-glass btn-sm menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">{icon("menu")}</button>
      {THEME_SWITCH}
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
  <button class="btn btn-glass btn-sm close menu-close" type="button" aria-label="Close menu" style="width:48px;padding:0;color:#fff">{icon("x")}</button>
  <ul>{mobile_links}</ul>
  {THEME_CHOICE}
</div>
<main id="main">
{body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <span class="wordmark footer-mark" role="img" aria-label="Aquoral"></span>
        <p class="footer-blurb">Aquoral protective oral spray for lasting relief from the symptoms of dry mouth. Now available in Canada.</p>
      </div>
      <div><h3>Product</h3><ul><li><a href="{base}how-it-works.html">How it works</a></li><li><a href="{base}how-to-use.html">How to use</a></li><li><a href="{base}evidence.html">Evidence</a></li><li><a href="{base}order.html">Order</a></li><li><a href="{base}faq.html">FAQ</a></li></ul></div>
      <div><h3>Dry mouth</h3><ul><li><a href="{base}dry-mouth.html">Causes and who it helps</a></li><li><a href="{base}medications.html">Medications</a></li><li><a href="{base}conditions/cancer.html">Cancer treatment</a></li><li><a href="{base}conditions/sjogrens.html">Sjögren’s</a></li><li><a href="{base}conditions/cpap.html">CPAP and sleep apnea</a></li><li><a href="{base}conditions/diabetes.html">Diabetes</a></li><li><a href="{base}learn.html">Articles</a></li><li><a href="{base}assessment.html">Free dry mouth assessment</a></li></ul></div>
      <div><h3>Company</h3><ul><li><a href="{base}contact.html">Contact</a></li><li><a href="{base}safety.html">Safety information</a></li><li><a href="{base}privacy.html">Privacy</a></li><li><a href="{base}terms.html">Terms</a></li></ul></div>
    </div>
    <div class="footer-base"><span>© 2026 Aquoral Canada. Aquoral is a registered trademark.</span><span>Prototype for review. Product claims pending Canadian label approval.</span></div>
  </div>
</footer>
<script src="{base}assets/js/site.js" defer></script>
{stage_js}
{hero_js}
</body>
</html>
'''

def render(text, base):
    text = re.sub(r'\{\{icon:([a-z-]+)(?::([a-z-]+))?\}\}', lambda m: icon(m.group(1), m.group(2) or 'icon'), text)
    text = re.sub(r'\{\{cause:([a-z-]+)\}\}', lambda m: cause_icon(m.group(1)), text)
    return text.replace('{{base}}', base)

def build():
    if DIST.exists(): shutil.rmtree(DIST)
    (DIST / 'assets').mkdir(parents=True)
    for sub in ['css', 'js', 'img', 'video']:
        shutil.copytree(HERE / 'assets' / sub, DIST / 'assets' / sub)
    # design-system tokens: root (colour + motifs, source of truth) then v2 (type, glass, components)
    # design-system: root tokens are the colour + type source of truth; site.css adds the site layer
    (DIST / 'assets' / 'css' / 'tokens.css').write_text((DS / 'aquoral-tokens.css').read_text())
    if ARTIFACT:
        data = {n: base64.b64encode((HERE / 'assets' / 'models' / f'{n}.glb').read_bytes()).decode() for n in ['bottle', 'box']}
        (DIST / 'assets' / 'js' / 'models.js').write_text('window.AQ_GLB=' + json.dumps(data) + ';')
    else:
        shutil.copytree(HERE / 'assets' / 'models', DIST / 'assets' / 'models')
    count = 0
    for f in sorted((SRC / 'pages').rglob('*.html')):
        rel = f.relative_to(SRC / 'pages')
        base = '../' * (len(rel.parts) - 1)
        raw = f.read_text()
        m = re.match(r'\s*<!--(\{.*?\})-->\s*', raw, re.S)
        meta = json.loads(m.group(1)); body = raw[m.end():]
        out = DIST / rel; out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render(layout(meta, body, base), base)); count += 1
    # Cache-bust: tag every local CSS/JS reference with a hash of the built assets, so browsers never pair a new
    # page with a stale cached stylesheet or script (2026-11-11: that rendered new markup unstyled on phones).
    h = hashlib.sha1(b''.join(f.read_bytes() for f in sorted((DIST / 'assets').rglob('*')) if f.suffix in ('.css', '.js'))).hexdigest()[:10]
    for f in DIST.rglob('*.html'):
        f.write_text(re.sub(r'((?:href|src)="(?:\.\./)*assets/(?:css|js)/[\w.-]+\.(?:css|js))"', rf'\1?v={h}"', f.read_text()))
    if ARTIFACT:   # the artifact host wraps the entry page in its own skeleton
        ix = DIST / 'index.html'; t = ix.read_text()
        t = t.replace('<!doctype html>\n<html lang="en-CA" class="no-js">\n<head>\n', '').replace('</head>\n<body', '<div hidden></div><body-x', 1)
        t = re.sub(r'<body-x class="([^"]*)">', lambda m: f'<script>document.documentElement.lang="en-CA";document.documentElement.classList.add("no-js");document.addEventListener("DOMContentLoaded",()=>document.body.className+=" {m.group(1)}")</script>', t, count=1)
        t = t.replace('</body>\n</html>\n', '').replace('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n', '')
        ix.write_text(t)
    print(f'built {count} pages -> {DIST}{" (artifact mode)" if ARTIFACT else ""}')

if __name__ == '__main__':
    build()
