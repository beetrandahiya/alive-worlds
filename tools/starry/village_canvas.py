"""The canvas over the village, as the skin of the buildings.

Writes `public/starry/village_canvas.jpg`: the scan itself, at its full
sharpness, over the part of the painting where the village, its trees and the
spire stand (1280-units x 520..1269, y 620..1006). And `village_run.png`: the
same area at 1 px per unit; red = the direction the stroke at that point runs
(0..255 -> -90..+90 degrees, 0 = level, positive = rising to the right),
green = how strongly the strokes there agree.
"""
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
img = cv2.imread(str(ROOT / "reference" / "starry_7000.jpg"))
K = img.shape[1] / 1280.0
X0, Y0, X1, Y1 = 520, 620, 1269, 1006
x0, y0, x1, y1 = [int(round(v * K)) for v in (X0, Y0, X1, Y1)]
crop = img[y0:y1, x0:x1]
crop = cv2.resize(crop, (4096, int(round(4096 * crop.shape[0] / crop.shape[1]))), interpolation=cv2.INTER_AREA)
cv2.imwrite(str(ROOT / "public" / "starry" / "village_canvas.jpg"), crop, [cv2.IMWRITE_JPEG_QUALITY, 90])

grey = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 2.0)
gx, gy = cv2.Sobel(grey, cv2.CV_32F, 1, 0), cv2.Sobel(grey, cv2.CV_32F, 0, 1)
jxx, jxy, jyy = [cv2.GaussianBlur(a, (0, 0), 9.0)[y0:y1, x0:x1] for a in (gx * gx, gx * gy, gy * gy)]
along = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + math.pi / 2      # image axes, y down
ang = -np.arctan2(np.sin(along), np.cos(along))
ang = (ang + math.pi / 2) % math.pi - math.pi / 2
agree = np.hypot(jxx - jyy, 2 * jxy) / (jxx + jyy + 1e-9)
size = (X1 - X0, Y1 - Y0)
out = np.zeros((size[1], size[0], 3), np.uint8)
out[..., 2] = cv2.resize(np.clip((ang / math.pi + 0.5) * 255, 0, 255), size, interpolation=cv2.INTER_NEAREST).astype(np.uint8)
out[..., 1] = cv2.resize(np.clip(agree * 255, 0, 255), size, interpolation=cv2.INTER_AREA).astype(np.uint8)
cv2.imwrite(str(ROOT / "public" / "starry" / "village_run.png"), out)
print(crop.shape, out.shape)
