"""His strokes on the trees, traced one by one off the canvas.

Over the groves and bushes, each stroke is followed along its own length: from
a point of paint, along the direction the paint runs there, both ways, for as
long as the colour stays that stroke's colour. What comes out is a list of his
real strokes: where each starts, where it ends, how far it bows, how wide it
is, its colour and the colour streaked beside it.

Writes public/starry/tree_strokes.bin (float32 x 12 per stroke: x0 y0 x1 y1
bow width r g b r2 g2 b2, in 1280-px units) and reference/debug_tree_strokes.jpg.
Run: python3 tools/starry/tree_strokes.py
"""
import math
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
img = cv2.imread(str(ROOT / "reference" / "starry_7000.jpg"))
K = img.shape[1] / 1280.0
X0, Y0, X1, Y1 = 520, 680, 1280, 1012
S = 4.0                                    # work at a quarter of the scan
crop = img[int(Y0 * K):int(Y1 * K), int(X0 * K):int(X1 * K)]
small = cv2.resize(crop, None, fx=1 / S, fy=1 / S, interpolation=cv2.INTER_AREA)
h, w = small.shape[:2]
lab = cv2.cvtColor(cv2.GaussianBlur(small, (0, 0), 1.0), cv2.COLOR_BGR2LAB).astype(np.float32)
grey = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.2)
gx, gy = cv2.Sobel(grey, cv2.CV_32F, 1, 0), cv2.Sobel(grey, cv2.CV_32F, 0, 1)
jxx, jxy, jyy = [cv2.GaussianBlur(a, (0, 0), 3.0) for a in (gx * gx, gx * gy, gy * gy)]
ang = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + math.pi / 2          # the way the paint runs
coh = np.hypot(jxx - jyy, 2 * jxy) / (jxx + jyy + 1e-6)
dx, dy = np.cos(ang), np.sin(ang)


def at(a, x, y):
    return a[min(max(int(round(y)), 0), h - 1), min(max(int(round(x)), 0), w - 1)]


taken = np.zeros((h, w), np.uint8)
strokes = []
seeds = [(x, y) for y in range(3, h - 3, 3) for x in range(3, w - 3, 3)]
seeds.sort(key=lambda p: -coh[p[1], p[0]])
for sx, sy in seeds:
    if taken[sy, sx]:
        continue
    c0 = lab[sy, sx].copy()
    path = [(float(sx), float(sy))]
    for sign in (1, -1):
        x, y = float(sx), float(sy)
        vx, vy = dx[sy, sx] * sign, dy[sy, sx] * sign
        for _ in range(140):
            ux, uy = at(dx, x, y), at(dy, x, y)
            if ux * vx + uy * vy < 0:
                ux, uy = -ux, -uy
            if ux * vx + uy * vy < 0.86:                # the paint turns sharply: the stroke has ended
                break
            vx, vy = ux, uy
            x, y = x + vx * 1.2, y + vy * 1.2
            if not (1 < x < w - 2 and 1 < y < h - 2):
                break
            d = at(lab, x, y) - c0
            if abs(d[0]) > 26 or math.hypot(d[1], d[2]) > 15 or at(taken, x, y):
                break
            path.append((x, y)) if sign > 0 else path.insert(0, (x, y))
    if len(path) < 14:
        continue
    P = np.array(path)
    a, b = P[0], P[-1]
    chord = b - a
    L = np.hypot(*chord)
    if L < 14:
        continue
    t = chord / L
    nrm = np.array([-t[1], t[0]])
    mid = P[len(P) // 2]
    bow = float((mid - (a + b) / 2) @ nrm) / L
    # width: how far the stroke's colour holds to either side of its middle
    wd = 0
    for sg in (1, -1):
        for k in range(1, 14):
            q = mid + nrm * sg * k
            d = at(lab, q[0], q[1]) - c0
            if abs(d[0]) > 22 or math.hypot(d[1], d[2]) > 13:
                break
            wd += 1
    wd = max(3.0, min(wd + 1.0, 16.0))
    cv2.polylines(taken, [P.astype(np.int32)], False, 1, int(max(2, wd * 0.75)))
    col = np.median(np.array([at(small, x, y) for x, y in path]), 0)[::-1] / 255
    side = mid + nrm * (wd * 0.5 + 1.5) * (1 if bow >= 0 else -1)
    col2 = at(small, side[0], side[1])[::-1] / 255.0
    f = S / K
    strokes.append([X0 + a[0] * f, Y0 + a[1] * f, X0 + b[0] * f, Y0 + b[1] * f, bow, wd * f, *col, *col2])

out = np.array(strokes, np.float32)
out.tofile(ROOT / "public" / "starry" / "tree_strokes.bin")
L = np.hypot(out[:, 2] - out[:, 0], out[:, 3] - out[:, 1])
print(len(out), "strokes; length in canvas cm: median %.1f, 90%% %.1f; width median %.2f cm" % (np.median(L) / 13.9, np.percentile(L, 90) / 13.9, np.median(out[:, 5]) / 13.9))

# check picture: the canvas above, the traced strokes redrawn below
Z = 3
big = cv2.resize(crop, ((X1 - X0) * Z, (Y1 - Y0) * Z), interpolation=cv2.INTER_AREA)
re = np.full_like(big, 30)
for s in sorted(strokes, key=lambda s: -(s[5])):
    a = np.array([(s[0] - X0) * Z, (s[1] - Y0) * Z]); b = np.array([(s[2] - X0) * Z, (s[3] - Y0) * Z])
    ch = b - a; Lc = np.hypot(*ch); n = np.array([-ch[1], ch[0]]) / Lc
    pts = np.array([a + ch * u + n * (4 * s[4] * Lc * u * (1 - u)) for u in np.linspace(0, 1, 9)], np.int32)
    cv2.polylines(re, [pts], False, [int(v * 255) for v in s[6:9][::-1]], max(2, int(s[5] * Z * 0.9)), cv2.LINE_AA)
cv2.imwrite(str(ROOT / "reference" / "debug_tree_strokes.jpg"), np.vstack([big, re]), [cv2.IMWRITE_JPEG_QUALITY, 82])
