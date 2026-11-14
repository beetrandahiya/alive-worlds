"""Generate the brush-stroke atlas: 8 stroke shapes, 2 columns x 4 rows.

Each stroke is laid along +u. Channels:
  R,G  surface slope of the paint (relief, for light catching the ridges)
  B    bristle streak value (used to streak a second colour through the stroke)
  A    coverage (soft edge; sharpened in the shader)

Procedural for now. To be replaced by strokes lifted from a high-resolution
scan of the canvas once we have one.

Run: python3 tools/starry/make_strokes.py
"""
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
rng = np.random.default_rng(5)
CW, CH = 256, 64
atlas = np.zeros((CH * 4, CW * 2, 4), np.float32)


def noise_rows(n_rows, n_cols, corr_u, corr_v):
    a = rng.normal(size=(n_rows, n_cols)).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), sigmaX=corr_u, sigmaY=corr_v)
    return (a - a.mean()) / (a.std() + 1e-6)


for k in range(8):
    u = np.linspace(0, 1, CW, dtype=np.float32)[None, :]
    v = np.linspace(-1, 1, CH, dtype=np.float32)[:, None]
    bristle = 0.6 * noise_rows(CH, CW, 60, 1.1) + 0.4 * noise_rows(CH, CW, 25, 0.6)
    bristle = np.clip(0.5 + 0.33 * bristle, 0, 1)
    edge_wob = cv2.GaussianBlur(rng.normal(size=(1, CW)).astype(np.float32), (0, 0), 14)
    edge_wob2 = cv2.GaussianBlur(rng.normal(size=(1, CW)).astype(np.float32), (0, 0), 14)
    edge_wob, edge_wob2 = edge_wob / (np.abs(edge_wob).max() + 1e-6), edge_wob2 / (np.abs(edge_wob2).max() + 1e-6)
    start = np.sqrt(np.clip(u / rng.uniform(0.05, 0.1), 0, 1))           # rounded where the brush lands
    taper = 1 - 0.35 * np.clip((u - 0.6) / 0.4, 0, 1) ** 2               # lifts off thinner
    half = 0.74 * start * taper
    top = half * (1 + 0.1 * edge_wob)
    bot = -half * (1 + 0.1 * edge_wob2)
    inside = np.minimum(top - v, v - bot)
    dry_from = rng.uniform(0.5, 0.8)
    dry = np.clip((u - dry_from) / (0.96 - dry_from), 0, 1.2) ** 1.5      # paint runs out
    cover = np.minimum(inside * 9.0, 1.0) - dry * (1.25 - bristle) * 1.5
    cover *= (u < 0.985) & (u > 0.012)
    mask = (cover > 0).astype(np.float32)
    alpha = np.clip(cv2.GaussianBlur(mask, (0, 0), 1.6), 0, 1)
    ridge = np.exp(-(inside / 0.16) ** 2)                                  # paint pushed to the sides
    lump = np.exp(-((u - 0.07) / 0.06) ** 2) * 0.35                        # and piled where it lands
    height = (0.45 + 0.5 * bristle + 0.55 * ridge + lump) * (1 - 0.5 * dry.clip(0, 1))
    height = cv2.GaussianBlur(height * mask, (0, 0), 1.0)
    hu = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) * 0.6
    hv = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) * 0.6
    cell = np.stack([np.clip(0.5 - hu, 0, 1), np.clip(0.5 - hv, 0, 1), bristle, alpha], -1)
    cell[0, :, 3] = cell[-1, :, 3] = 0
    r, c = k // 2, k % 2
    atlas[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] = cell

out = (atlas[:, :, [2, 1, 0, 3]] * 255).astype(np.uint8)  # to BGRA for OpenCV
cv2.imwrite(str(ROOT / "public" / "starry" / "strokes.png"), out)
prev = np.dstack([np.repeat(out[:, :, 3:4], 3, 2)]) 
cv2.imwrite(str(ROOT / "reference" / "debug_strokes.jpg"), np.vstack([prev, out[:, :, :3]]))
print("atlas", out.shape)
