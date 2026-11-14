"""The real skyline round Saint-Paul-de-Mausole, Saint-Remy-de-Provence.

Fetches free elevation tiles (Mapzen "terrarium" tiles hosted on AWS Open
Data) and works out, for every compass bearing, how high the land stands
above eye level as seen from the asylum's upper floor.

Writes reference/real_skyline.npy: 1024 angles in radians, index 0 = north,
going clockwise. Run once; analyse.py reads the file.
"""
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "reference" / "dem"
CACHE.mkdir(parents=True, exist_ok=True)
LAT, LON, Z, SPAN = 43.7765, 4.8335, 12, 2      # approximate position of the asylum
n = 2 ** Z
fx = (LON + 180) / 360 * n
fy = (1 - math.asinh(math.tan(math.radians(LAT))) / math.pi) / 2 * n
x0, y0 = int(fx) - SPAN, int(fy) - SPAN
rows = []
for ty in range(y0, y0 + 2 * SPAN + 1):
    row = []
    for tx in range(x0, x0 + 2 * SPAN + 1):
        f = CACHE / f"{Z}_{tx}_{ty}.png"
        if not f.exists():
            subprocess.run(["curl", "-sS", "-o", str(f),
                            f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png"], check=True)
        i = cv2.imread(str(f)).astype(np.float64)
        row.append(i[:, :, 2] * 256 + i[:, :, 1] + i[:, :, 0] / 256 - 32768)
    rows.append(np.hstack(row))
dem = np.vstack(rows)
m_per_px = 40075016.686 * math.cos(math.radians(LAT)) / n / 256
cx, cy = (fx - x0) * 256, (fy - y0) * 256
eye = dem[int(cy), int(cx)] + 7.0
bearing = np.arange(1024) / 1024 * 2 * np.pi
r = np.arange(120.0, SPAN * 256 * m_per_px, m_per_px * 0.7)
px = cx + np.sin(bearing)[:, None] * r[None, :] / m_per_px
py = cy - np.cos(bearing)[:, None] * r[None, :] / m_per_px
h = cv2.remap(dem.astype(np.float32), px.astype(np.float32), py.astype(np.float32), cv2.INTER_LINEAR)
ang = np.arctan2(h - eye - r[None, :] ** 2 / (2 * 6371000 * 1.15), r[None, :])
sky = ang.max(1)
np.save(ROOT / "reference" / "real_skyline.npy", sky.astype(np.float32))
deg = np.degrees(sky)
print("eye at", round(eye, 1), "m; skyline in degrees by bearing:")
for b in range(0, 360, 30):
    print(f"  {b:3d}: {deg[int(b / 360 * 1024)]:.1f}")
print("highest", round(deg.max(), 1), "at bearing", round(np.degrees(bearing[deg.argmax()])))
