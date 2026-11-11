"""Build the self-contained artifact page from hero/index.html.
Inlines the design-system tokens and the bottle GLB (artifact hosting serves neither ../ paths nor .glb).
Usage: python3 build.py OUT.html"""
import base64, pathlib, re, sys
here = pathlib.Path(__file__).resolve().parent
s = (here / 'index.html').read_text()
tokens = (here.parent / 'design-system' / 'aquoral-tokens.css').read_text()
s = re.sub(r'<link rel="stylesheet" href="../design-system/aquoral-tokens.css" data-inline-tokens>', lambda m: '<style>\n' + tokens + '\n</style>', s)
models = here.parent / '3d-models'
def inline(elem_id, *names):
    for n in names:
        f = models / n
        if f.exists():
            return '<script type="application/octet-stream" id="%s">%s</script>\n' % (elem_id, base64.b64encode(f.read_bytes()).decode())
    return ''
# Canadian label builds first (no US 'Prescription Only' / patent lines)
blobs = inline('glb-data', 'aquoral-bottle-ca.glb', 'aquoral-bottle.glb') + inline('glb-box', 'aquoral-carton-ca.glb', 'aquoral-box-ca.glb')
s = s.replace('<script type="importmap">', blobs + '<script type="importmap">', 1)
# artifact skeleton supplies doctype/html/head/body and the charset/viewport metas
for a in ['<!doctype html>\n<html lang="en-CA">\n<head>\n', '</head>\n<body>\n', '</body>\n</html>\n',
          '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n']:
    s = s.replace(a, '')
s = s.replace('<title>Aquoral Hero Prototype</title>', '<title>Aquoral Hero Prototype</title>\n<meta name="claude:viewport-fit-sides" content="cover">', 1)
pathlib.Path(sys.argv[1]).write_text(s)
print('wrote', sys.argv[1], len(s), 'bytes')
