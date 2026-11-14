"""Read the painted village off the canvas, building by building.

Each building he painted is listed below as it appears on the 1280 px wide
scan: left and right edges, where its wall meets the ground, its eave line and
its roof top, read by eye against a grid. Following the line of sight from the
viewpoint to the valley floor turns those into a position and a size in
metres, so that a real building standing there looks, from the start, as he
painted it. Wall and roof colours are taken from the canvas.

Writes public/starry/village.json. Run: python3 tools/starry/village.py
"""
import json
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
img = cv2.imread(str(ROOT / "reference" / "starry_7000.jpg"))
K = img.shape[1] / 1280.0
W, H = 1280.0, 1280.0 * img.shape[0] / img.shape[1]
F = 0.5 / math.tan(math.radians(65.0) / 2) * W
PITCH = math.atan((710.0 - H / 2) / F)
EYE, FLOOR = 1.6, -28.0


def ray(px, py):
    x, y = (px - W / 2) / F, -(py - H / 2) / F
    d = np.array([x, y * math.cos(PITCH) + math.sin(PITCH), -(math.cos(PITCH) - y * math.sin(PITCH))])
    return d / np.linalg.norm(d)


def ground(px, py):
    d = ray(px, py)
    t = (FLOOR - EYE) / d[1]
    return d[0] * t, d[2] * t, t


def colour(rect, cut=45):
    """The paint in a patch: its lighter side, so dark outlines do not win."""
    x0, y0, x1, y1 = [int(v * K) for v in rect]
    x0, x1 = max(0, min(x0, img.shape[1] - 8)), max(8, min(x1, img.shape[1]))
    y0, y1 = max(0, min(y0, img.shape[0] - 8)), max(8, min(y1, img.shape[0]))
    p = img[y0:y1, x0:x1].reshape(-1, 3).astype(np.float32)
    lum = p @ np.array([0.114, 0.587, 0.299], np.float32)
    p = p[lum >= np.percentile(lum, cut)]
    return [round(float(v) / 255, 3) for v in np.median(p, 0)[::-1]]


prs = np.random.default_rng(9)
soft = None


def strokes_in(rect, n=28):
    """Colours of individual strokes in a patch of canvas: single points of the
    lightly smoothed scan, so each is one stroke's paint and not an average."""
    global soft
    if soft is None:
        soft = cv2.GaussianBlur(img, (0, 0), 2.2)
    x0, y0, x1, y1 = [int(v * K) for v in rect]
    xs, ys = prs.integers(x0, max(x1, x0 + 2), n), prs.integers(y0, max(y1, y0 + 2), n)
    return [[round(float(v) / 255, 3) for v in soft[y, x][::-1]] for x, y in zip(xs, ys)]


def darkest(rect):
    """His outline colour here: the dark line he drew round this building."""
    x0, y0, x1, y1 = [int(v * K) for v in rect]
    p = img[y0:y1, x0:x1].reshape(-1, 3).astype(np.float32)
    lum = p @ np.array([0.114, 0.587, 0.299], np.float32)
    return [round(float(v) / 255, 3) for v in np.median(p[lum <= np.percentile(lum, 12)], 0)[::-1]]


_g = None
measured = []


def stroke_run(rect):
    """Which way his strokes run in a patch of canvas, and how strongly they
    agree. Angle in radians, 0 = level, positive = rising to the right.
    Agreement 0 (every way) to 1 (all one way). Also their typical width in
    canvas centimetres, from how quickly the paint changes across them."""
    global _g
    if _g is None:
        grey = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 2.0)
        _g = (cv2.Sobel(grey, cv2.CV_32F, 1, 0), cv2.Sobel(grey, cv2.CV_32F, 0, 1))
    x0, y0, x1, y1 = [int(v * K) for v in rect]
    gx, gy = _g[0][y0:y1, x0:x1], _g[1][y0:y1, x0:x1]
    jxx, jxy, jyy = float((gx * gx).mean()), float((gx * gy).mean()), float((gy * gy).mean())
    along = 0.5 * math.atan2(2 * jxy, jxx - jyy) + math.pi / 2          # in image axes, y down
    agree = math.hypot(jxx - jyy, 2 * jxy) / (jxx + jyy + 1e-9)
    ang = -math.atan2(math.sin(along), math.cos(along))
    ang = (ang + math.pi / 2) % math.pi - math.pi / 2
    measured.append((rect, ang, agree))
    return round(ang, 3), round(agree, 3)


def building(x0, x1, base, eave, top, wall, roof, lit=0, gable=False, cut=45):
    cx, cz, dist = ground((x0 + x1) / 2, base)
    scale = dist / F
    return dict(x=round(float(cx), 2), z=round(float(cz), 2), w=round(float((x1 - x0) * scale), 2),
                wall=round(float(max((base - eave) * scale, 2.6)), 2), rise=round(float(max((eave - top) * scale, 1.2)), 2),
                wallColour=colour(wall, cut), roofColour=colour(roof), lit=lit, gable=gable,
                wallPal=strokes_in(wall), roofPal=strokes_in(roof), outline=darkest((x0, top, x1, base)),
                wallRun=stroke_run(wall), roofRun=stroke_run(roof))


houses = [
    building(548, 598, 878, 862, 840, (555, 864, 595, 876), (560, 845, 590, 860)),
    building(598, 640, 890, 858, 838, (600, 862, 612, 886), (602, 842, 636, 856), lit=1),
    building(762, 805, 885, 860, 845, (764, 862, 800, 882), (764, 847, 800, 858)),
    building(850, 935, 892, 862, 838, (886, 866, 930, 888), (860, 842, 925, 860), lit=1),
    building(905, 962, 852, 836, 824, (906, 838, 930, 850), (910, 826, 955, 835), lit=1),
    building(960, 1072, 908, 885, 872, (1026, 892, 1068, 906), (965, 874, 1065, 884), lit=2),
    building(1028, 1082, 942, 912, 900, (1032, 914, 1078, 938), (1032, 902, 1078, 911), lit=1),
    building(1085, 1152, 946, 922, 912, (1090, 924, 1130, 944), (1090, 913, 1148, 921), lit=1),
    building(655, 725, 942, 918, 905, (660, 920, 720, 940), (660, 906, 718, 917)),
    building(725, 800, 1000, 925, 898, (728, 955, 745, 995), (735, 902, 795, 922), lit=2),
    building(790, 905, 1012, 975, 935, (800, 978, 880, 1000), (800, 940, 895, 972)),
    building(885, 985, 1034, 1000, 965, (935, 1000, 975, 1012), (895, 968, 975, 998)),
]
church = dict(
    nave=building(640, 712, 893, 850, 822, (650, 862, 690, 886), (662, 830, 700, 848), gable=True, cut=80),
    tower=building(716, 738, 893, 800, 800, (720, 840, 734, 885), (722, 760, 732, 795), cut=80),
    wing=building(738, 762, 893, 856, 845, (740, 860, 760, 888), (740, 846, 760, 855)),
)
tip = ray(727, 632)
tx, tz, td = ground(727, 893)
church["spireTop"] = round(float(EYE + td * tip[1] / math.hypot(tip[0], tip[2]) * 1.0 - FLOOR), 1)


def tree(cx, base, wpx, hpx, rect):
    x, z, dist = ground(cx, base)
    return dict(x=round(float(x), 2), z=round(float(z), 2), r=round(float(wpx / 2 * dist / F), 2), h=round(float(hpx * dist / F), 2), colour=colour(rect))


trees = [
    tree(965, 1000, 95, 88, (930, 925, 1000, 990)),
    tree(1215, 1014, 140, 110, (1160, 915, 1270, 1005)),
    tree(815, 882, 62, 46, (790, 842, 845, 878)),
    tree(1225, 885, 120, 78, (1170, 815, 1275, 880)),
    tree(1130, 905, 70, 52, (1100, 860, 1160, 900)),
]
rs = np.random.default_rng(3)
for base, size in ((858, 62), (832, 56), (808, 50)):          # the grove behind the village, row after row
    for cx in np.arange(560, 1300, size * 0.82):
        if base == 858 and 640 < cx < 1080:
            continue                                          # the houses stand here
        c = float(cx + rs.uniform(-8, 8))
        trees.append(tree(c, base + rs.uniform(-5, 5), size * rs.uniform(0.85, 1.15), size * 0.72,
                          (c - 20, base - 34, c + 20, base - 6)))

out = dict(camera=dict(F=F, pitch=PITCH, W=W, H=H), houses=houses, church=church, trees=trees,
           road=colour((1100, 950, 1180, 962)), field=colour((600, 955, 715, 995)))
(ROOT / "public" / "starry" / "village.json").write_text(json.dumps(out))
print(len(houses), "houses", len(trees), "trees; church nave", church["nave"], "spire top", church["spireTop"])
for h in houses:
    print(h["x"], h["z"], h["w"], h["wall"], h["rise"])

# a picture of what was measured, for checking by eye
x0, y0, x1, y1 = [int(v * K) for v in (520, 780, 1280, 1014)]
dbg = img[y0:y1, x0:x1].copy()
for rect, ang, agree in measured:
    cx, cy = (rect[0] + rect[2]) / 2 * K - x0, (rect[1] + rect[3]) / 2 * K - y0
    L = 70
    cv2.rectangle(dbg, (int(rect[0] * K - x0), int(rect[1] * K - y0)), (int(rect[2] * K - x0), int(rect[3] * K - y0)), (255, 255, 255), 2)
    cv2.line(dbg, (int(cx - L * math.cos(ang)), int(cy + L * math.sin(ang))), (int(cx + L * math.cos(ang)), int(cy - L * math.sin(ang))), (0, 255, 255), 6)
    cv2.putText(dbg, f"{math.degrees(ang):.0f} {agree:.2f}", (int(cx - 60), int(cy - 14)), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 3)
cv2.imwrite(str(ROOT / "reference" / "debug_village_runs.jpg"), cv2.resize(dbg, (2000, int(dbg.shape[0] * 2000 / dbg.shape[1]))))
