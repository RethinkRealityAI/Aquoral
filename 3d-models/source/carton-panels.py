#!/usr/bin/env python3
"""Cut the six carton faces out of the client's dieline PDF (Aquoral Box Canada 3, 2026-11-13).
usage: python3 carton-panels.py "Aquoral-Box-Canada-3.pdf" out_dir
Renders the PDF at 600 dpi with pdftoppm, crops each panel inside the green dieline (coordinates measured from the
render), whitens the green varnish-free/LOT zone and resizes to 2048 px tall textures for build-carton-ca3.html."""
import subprocess, sys, pathlib, tempfile
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
pdf, out = sys.argv[1], pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
tmp = pathlib.Path(tempfile.mkdtemp())
subprocess.run(['pdftoppm', '-r', '600', '-png', pdf, str(tmp / 'p')], check=True)
im = Image.open(next(tmp.glob('p*.png'))).convert('RGB')
# x0, y0, x1, y1 at 600 dpi (dieline folds: x 180 | 1191 | 3093 | 4135 | 6035, y 3072..6660; top flap above the back, bottom below the front)
P = {'front': (1191, 3072, 3093, 6660), 'side-fr': (3093, 3072, 4135, 6660), 'back': (4135, 3054, 6035, 6660),
     'side-en': (180, 3072, 1191, 6660), 'top': (4135, 2013, 6035, 3054), 'bottom': (1191, 6660, 3093, 7701)}
for n, (x0, y0, x1, y1) in P.items():
    a = np.array(im.crop((x0 + 7, y0 + 7, x1 - 7, y1 - 7))).astype(int)
    a[(a[..., 1] > a[..., 0] + 20) & (a[..., 1] > a[..., 2] + 5)] = 255   # dieline green / varnish-free zone -> paper white
    size = (1086, 594) if n in ('top', 'bottom') else (1086, 2048) if n in ('front', 'back') else (594, 2048)
    Image.fromarray(a.astype(np.uint8)).resize(size, Image.LANCZOS).save(out / f'{n}.png'); print(n)
