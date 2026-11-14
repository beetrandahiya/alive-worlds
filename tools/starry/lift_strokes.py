"""Lift real brush strokes from the canvas and build the stroke atlas.

Reads   reference/starry_7000.jpg
Writes  public/starry/strokes.png   (8 strokes, 2 columns x 4 rows; see shaders)
        reference/debug_lifted.jpg  (contact sheet of candidates, for choosing)

A stroke is found by looking along the measured stroke direction at a point in
the sky and growing a region of paint of the same colour. Good candidates are
single, well separated marks. Their outline becomes the stroke's shape; the
light and shade the photograph recorded on the ridges of paint becomes its
relief.

Run: python3 tools/starry/lift_strokes.py            (contact sheet only)
     python3 tools/starry/lift_strokes.py 3 7 12 ...  (8 chosen -> atlas)
"""
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
rng = np.random.default_rng(3)
img = cv2.imread(str(ROOT / "reference" / "starry_7000.jpg"))
H, W = img.shape[:2]
S = W / 1280.0
CW, CH = 256, 64          # atlas cell
BW, BH = 520, 130         # box lifted from the canvas, in scan pixels

small = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
g = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 2)
gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)
jxx, jxy, jyy = (cv2.GaussianBlur(a, (0, 0), 7) for a in (gx * gx, gx * gy, gy * gy))
theta = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + np.pi / 2
coher = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-6)

cands = []
tries = 0
while len(cands) < 60 and tries < 40000:
    tries += 1
    x, y = rng.uniform(0.04, 0.96) * W, rng.uniform(0.04, 0.6) * H
    if 150 * S < x < 420 * S and y > 40 * S:      # the cypress
        continue
    if coher[int(y / 4), int(x / 4)] < 0.55:
        continue
    ang = np.degrees(theta[int(y / 4), int(x / 4)])
    M = cv2.getRotationMatrix2D((x, y), ang, 1.0)
    M[0, 2] += BW / 2 - x
    M[1, 2] += BH / 2 - y
    box = cv2.warpAffine(img, M, (BW, BH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    lab = cv2.cvtColor(box, cv2.COLOR_BGR2LAB).astype(np.float32)
    core = lab[BH // 2 - 14:BH // 2 + 14, BW // 2 - 40:BW // 2 + 40].reshape(-1, 3)
    if core.std(0).sum() > 26:
        continue
    dist = cv2.GaussianBlur(np.linalg.norm(lab - np.median(core, 0), axis=-1), (0, 0), 2.5)
    m = (dist < 13).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lbl, stats, _ = cv2.connectedComponentsWithStats(m)
    k = lbl[BH // 2, BW // 2]
    if k == 0:
        continue
    m = cv2.morphologyEx((lbl == k).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    x0, y0, bw, bh, area = stats[k]
    if x0 <= 2 or x0 + bw >= BW - 2 or y0 <= 1 or y0 + bh >= BH - 1:
        continue
    if not (2.6 < bw / bh < 8 and 34 < bh < 112 and bw > 170):
        continue
    fill = area / (bw * bh)
    if fill < 0.6:
        continue
    cands.append(dict(score=fill * min(bw / bh / 4.0, 1.0), box=box, mask=m, rect=(x0, y0, bw, bh)))

cands.sort(key=lambda c: -c["score"])
cands = cands[:40]
rows = []
for i, c in enumerate(cands):
    vis = c["box"].copy()
    cnt, _ = cv2.findContours(c["mask"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(vis, cnt, -1, (255, 255, 255), 1)
    cv2.putText(vis, str(i), (6, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    rows.append(vis)
while len(rows) % 4:
    rows.append(np.zeros_like(rows[0]))
sheet = np.vstack([np.hstack(rows[i:i + 4]) for i in range(0, len(rows), 4)])
cv2.imwrite(str(ROOT / "reference" / "debug_lifted.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 85])
print("candidates", len(cands), "from", tries, "tries")

chosen = [int(a) for a in sys.argv[1:]]
if len(chosen) == 8:
    atlas = np.zeros((CH * 4, CW * 2, 4), np.float32)
    for slot, i in enumerate(chosen):
        c = cands[i]
        x0, y0, bw, bh = c["rect"]
        # Fit the stroke to the cell: centred, filling about 74% of the height.
        pad_x, pad_y = bw * 0.03, bh * (1 / 0.74 - 1) / 2
        src = np.float32([[x0 - pad_x, y0 - pad_y], [x0 + bw + pad_x, y0 - pad_y], [x0 - pad_x, y0 + bh + pad_y]])
        dst = np.float32([[0, 0], [CW, 0], [0, CH]])
        A = cv2.getAffineTransform(src, dst)
        mask = cv2.warpAffine(c["mask"].astype(np.float32), A, (CW, CH), flags=cv2.INTER_AREA)
        grey = cv2.warpAffine(cv2.cvtColor(c["box"], cv2.COLOR_BGR2GRAY).astype(np.float32) / 255, A, (CW, CH),
                              flags=cv2.INTER_AREA)
        alpha = np.clip(cv2.GaussianBlur((mask > 0.5).astype(np.float32), (0, 0), 1.4), 0, 1)
        # The photograph's light and shade on the paint stands in for its height.
        detail = grey - cv2.GaussianBlur(grey, (0, 0), 9)
        detail = detail / (np.abs(detail[mask > 0.5]).std() * 3 + 1e-6)
        edge = cv2.GaussianBlur(alpha, (0, 0), 3)          # paint stands proud of the canvas
        height = cv2.GaussianBlur(detail * 0.5 + edge * 0.9, (0, 0), 0.8)
        hu = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) * 0.55
        hv = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) * 0.55
        streak = np.clip(0.5 + detail * 0.5, 0, 1)
        cell = np.stack([np.clip(0.5 - hu, 0, 1), np.clip(0.5 - hv, 0, 1), streak, alpha], -1)
        cell[0, :, 3] = cell[-1, :, 3] = 0
        cell[:, 0, 3] = cell[:, -1, 3] = 0
        r, col = slot // 2, slot % 2
        atlas[r * CH:(r + 1) * CH, col * CW:(col + 1) * CW] = cell
    out = (atlas[:, :, [2, 1, 0, 3]] * 255).astype(np.uint8)
    cv2.imwrite(str(ROOT / "public" / "starry" / "strokes.png"), out)
    cv2.imwrite(str(ROOT / "reference" / "debug_strokes.jpg"),
                np.vstack([np.repeat(out[:, :, 3:4], 3, 2), out[:, :, :3]]))
    print("atlas written from", chosen)
