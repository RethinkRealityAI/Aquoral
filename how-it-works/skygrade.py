# Pull a too-saturated sky background toward the page's sky-50 -> white gradient while keeping
# neutral whites (bottle) and brighter mist intact. Reads/writes raw rgb24 frames on stdin/stdout.
import sys, numpy as np
W, H = int(sys.argv[1]), int(sys.argv[2]); STR = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
top = np.array([0xF2, 0xF9, 0xFE], np.float32); bot = np.array([255, 255, 255], np.float32)
t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
target = top * (1 - t) + bot * t
n = W * H * 3
while True:
    buf = sys.stdin.buffer.read(n)
    if len(buf) < n: break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
    blu = f[..., 2] - f[..., 0]
    w = np.clip((blu - 12) / 30, 0, 1); w = w * w * (3 - 2 * w) * STR
    # keep relative brightness (mist sparkle) by adding the pixel's excess over the row's sky median
    out = f * (1 - w[..., None]) + target * w[..., None]
    sys.stdout.buffer.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
