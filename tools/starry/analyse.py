"""Measure The Starry Night and bake the data the sky is built from.

Reads   reference/starry_7000.jpg   (Google Art Project scan, public domain;
        measured at 3200 px wide)
Writes  public/starry/sky_under.jpg     undercoat for the sky dome (equirect)
        public/starry/sky_strokes.bin   flowing sky strokes  (20 floats each)
        public/starry/land_strokes.bin  static backdrop strokes (hills, village)
        public/starry/starry.json       counts, camera, palettes

Run: python3 tools/starry/analyse.py
"""
import heapq
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "starry"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1889)

# ---------------------------------------------------------------- the painting
full = cv2.imread(str(ROOT / "reference" / "starry_7000.jpg"))
img8 = cv2.resize(full, (3200, round(3200 * full.shape[0] / full.shape[1])), interpolation=cv2.INTER_AREA)
del full
img = img8[:, :, ::-1].astype(np.float32) / 255.0
H, W = img.shape[:2]
SX = W / 1280.0  # by-eye coordinates below were read off the 1280 px scan

# Owner decision: the composition spans about 65 degrees at the viewpoint.
HFOV = np.radians(65.0)
F = 0.5 / np.tan(HFOV / 2) * W  # focal length in pixels
HORIZON_Y = 710 * SX            # eye level in the painting (by eye)
PITCH = np.arctan((HORIZON_Y - H / 2) / F)
INSET = 14 * SX                 # the scan shows bare canvas edge; stay inside
FEATHER = 44 * SX
EL_MIN = np.radians(-30.0)


def norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


CAM_F = np.array([0.0, np.sin(PITCH), -np.cos(PITCH)])
CAM_U = np.array([0.0, np.cos(PITCH), np.sin(PITCH)])
CAM_R = np.array([1.0, 0.0, 0.0])


def project(d):
    z = d @ CAM_F
    zs = np.where(z > 1e-3, z, 1.0)
    px = W / 2 + F * (d @ CAM_R) / zs
    py = H / 2 - F * (d @ CAM_U) / zs
    return px, py, z > 1e-3


def unproject(px, py):
    x = (px - W / 2) / F
    y = -(py - H / 2) / F
    return norm(x[:, None] * CAM_R + y[:, None] * CAM_U + CAM_F)


def samp(arr, px, py):
    """Bilinear sample with clamped edges."""
    hh, ww = arr.shape[:2]
    x = np.clip(px, 0, ww - 1.001)
    y = np.clip(py, 0, hh - 1.001)
    x0, y0 = x.astype(np.int64), y.astype(np.int64)
    fx, fy = (x - x0), (y - y0)
    if arr.ndim == 3:
        fx, fy = fx[:, None], fy[:, None]
    a = arr[y0, x0] * (1 - fx) + arr[y0, x0 + 1] * fx
    b = arr[y0 + 1, x0] * (1 - fx) + arr[y0 + 1, x0 + 1] * fx
    return (a * (1 - fy) + b * fy).astype(np.float32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------- masks
def poly(points):
    return (np.array(points, np.float32) * SX).astype(np.int32)


CYPRESS = poly([
    (148, 1014), (158, 900), (182, 780), (186, 640), (182, 540), (190, 470),
    (192, 330), (198, 318), (210, 400), (222, 300), (230, 200), (238, 100),
    (247, 46), (258, 100), (270, 200), (288, 300), (312, 400), (322, 500),
    (330, 575), (338, 588), (350, 640), (372, 596), (386, 588), (398, 640),
    (436, 690), (486, 740), (534, 790), (578, 850), (604, 900),
    (610, 1014)])
cyp = np.zeros((H, W), np.uint8)
cv2.fillPoly(cyp, [CYPRESS], 255)
cyp_core = cv2.erode(cyp, np.ones((5, 5), np.uint8))
cyp_in = (cyp_core > 0).astype(np.float32)   # well inside the tree's outline: never seen from the start
cyp = cv2.dilate(cyp, np.ones((int(15 * SX), int(15 * SX)), np.uint8))

RIDGE = np.array([
    # behind the cypress (px 195-440, hidden from the start) the hills carry on at a gentle height
    # instead of sinking to nothing: seen from anywhere else that gap was an empty blur
    (0, 735), (100, 750), (190, 760), (195, 758), (230, 728), (300, 712), (380, 715), (440, 730),
    (480, 742), (520, 702), (560, 690),
    (610, 700), (650, 716), (700, 700), (760, 652), (840, 634), (900, 650),
    (950, 664), (1000, 640), (1100, 600), (1150, 570), (1172, 526),
    (1210, 518), (1280, 514)], np.float32) * SX
ridge_y = np.interp(np.arange(W), RIDGE[:, 0], RIDGE[:, 1])
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
sky_mask = cv2.GaussianBlur((yy < ridge_y[None, :]).astype(np.float32), (0, 0), 6 * SX)

# ------------------------------------------- the scene with the cypress removed
# The cypress becomes a real tree in the world, so the backdrop needs sky behind
# it. Mean colour is diffused in from the edges; stroke-scale light/dark detail
# is borrowed from the paint just outside the tree.
# (the fill is smooth, so it is worked out small and enlarged)
_s8 = cv2.resize(img8, (1280, round(1280 * H / W)), interpolation=cv2.INTER_AREA)
_sm = cv2.resize(cyp, (_s8.shape[1], _s8.shape[0]), interpolation=cv2.INTER_NEAREST)
base = cv2.resize(cv2.inpaint(_s8, _sm, 9, cv2.INPAINT_TELEA), (W, H), interpolation=cv2.INTER_CUBIC)[:, :, ::-1].astype(np.float32) / 255
lum = img @ np.array([0.299, 0.587, 0.114], np.float32)
hp = lum - cv2.GaussianBlur(lum, (0, 0), 7 * SX)
cols = np.arange(W)
left = np.array([cols[r > 0].min() if r.any() else 0 for r in cyp])
right = np.array([cols[r > 0].max() if r.any() else 0 for r in cyp])
mid = (left + right) / 2
donor_x = np.where(xx < mid[:, None], 2 * left[:, None] - xx - 6, 2 * right[:, None] - xx + 6)
ok = (donor_x >= INSET) & (donor_x < W - INSET)
donor_hp = cv2.remap(hp, np.clip(donor_x, 0, W - 1).astype(np.float32), yy, cv2.INTER_LINEAR)
m = (cyp > 0)
scene = img.copy()
scene[m] = np.clip(base[m] + (np.clip(donor_hp, -0.16, 0.16) * ok)[m][:, None], 0, 1)
# Land hidden by the tree: the land beside it, mirrored across the tree's edge
# (a diffused fill reads as a grey patch once it is laid on real ground).
donor_col = cv2.remap(img, np.clip(donor_x, 0, W - 1).astype(np.float32), yy, cv2.INTER_LINEAR)
land_m = m & ok & (yy > ridge_y[None, :] + 2 * SX)
scene[land_m] = donor_col[land_m]
scene_soft = cv2.GaussianBlur(scene, (0, 0), 5.5 * SX)
scene_fine = cv2.GaussianBlur(scene, (0, 0), 1.1 * SX)
# The hills alone, as a source for carrying them on beyond the frame: the
# church spire stands in front of them in the painting and must not be copied.
spire = np.zeros((H, W), np.uint8)
cv2.fillPoly(spire, [poly([(712, 800), (716, 700), (724, 632), (731, 632), (742, 700), (748, 800)])], 255)
spire = cv2.dilate(spire, np.ones((int(9 * SX), int(9 * SX)), np.uint8))
hills_src = cv2.inpaint((scene * 255).astype(np.uint8), spire, 6 * SX, cv2.INPAINT_TELEA).astype(np.float32) / 255
hills_soft = cv2.GaussianBlur(hills_src, (0, 0), 5.5 * SX)
hills_fine = cv2.GaussianBlur(hills_src, (0, 0), 1.1 * SX)

# ------------------------------------------------------- stroke direction field
g = cv2.GaussianBlur(scene @ np.array([0.299, 0.587, 0.114], np.float32), (0, 0), 1.2 * SX)
gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
wgt = 1.0 - (cyp > 0).astype(np.float32)


def nconv(a, sigma):
    return cv2.GaussianBlur(a * wgt, (0, 0), sigma) / np.maximum(cv2.GaussianBlur(wgt, (0, 0), sigma), 1e-4)


J = np.stack([gx * gx, gx * gy, gy * gy], -1)
J_near = np.stack([nconv(J[..., i], 5 * SX) for i in range(3)], -1)
J_far = np.stack([nconv(J[..., i], 38 * SX) for i in range(3)], -1)
trust = smoothstep(0.15, 0.6, cv2.GaussianBlur(wgt, (0, 0), 5 * SX))[..., None]
J = J_near * trust + J_far * (1 - trust)
theta = 0.5 * np.arctan2(2 * J[..., 1], J[..., 0] - J[..., 2]) + np.pi / 2  # along the stroke
disc = np.sqrt((J[..., 0] - J[..., 2]) ** 2 + 4 * J[..., 1] ** 2)
coher = disc / np.maximum(J[..., 0] + J[..., 2], 1e-8)
line = np.stack([np.cos(theta), np.sin(theta)], -1).astype(np.float32)

# Strokes have a direction but no arrow. Give the sky one consistent sense of
# travel by spreading a choice outward from the most certain spot, always
# crossing to the best-agreeing neighbour first.
STEP = int(round(8 * SX))
lc = line[STEP // 2::STEP, STEP // 2::STEP].copy()
cc = coher[STEP // 2::STEP, STEP // 2::STEP]
gh, gw = lc.shape[:2]
done = np.zeros((gh, gw), bool)
start = np.unravel_index(np.argmax(cc * sky_mask[STEP // 2::STEP, STEP // 2::STEP]), cc.shape)
done[start] = True
heap = []


def push(i, j):
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = i + di, j + dj
        if 0 <= a < gh and 0 <= b < gw and not done[a, b]:
            w_ = abs(float(lc[i, j] @ lc[a, b])) * min(cc[i, j], cc[a, b])
            heapq.heappush(heap, (-w_, a, b, i, j))


push(*start)
while heap:
    _, a, b, i, j = heapq.heappop(heap)
    if done[a, b]:
        continue
    if lc[a, b] @ lc[i, j] < 0:
        lc[a, b] = -lc[a, b]
    done[a, b] = True
    push(a, b)
skyc = sky_mask[STEP // 2::STEP, STEP // 2::STEP]
if (lc[..., 0] * skyc).sum() < 0:  # overall the sky travels left to right
    lc = -lc
lc = cv2.GaussianBlur(lc, (0, 0), 1.0)
arrow = cv2.resize(lc, (W, H), interpolation=cv2.INTER_LINEAR)

# ------------------------------------------------------------------- palettes
def palette(mask, k):
    px = img[mask]
    px = px[rng.choice(len(px), min(len(px), 40000), replace=False)]
    _, lab, cen = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 1e-3), 3,
                             cv2.KMEANS_PP_CENTERS)
    cnt = np.bincount(lab.ravel(), minlength=k) / len(px)
    order = np.argsort(cen @ np.array([0.299, 0.587, 0.114]))
    return cen[order], cnt[order]


def region(x0, y0, x1, y1):
    r = np.zeros((H, W), bool)
    r[int(y0 * SX):int(y1 * SX), int(x0 * SX):int(x1 * SX)] = True
    return r


warm = (img[..., 0] + img[..., 1]) / 2 - img[..., 2]
calm_sky = (sky_mask > 0.95) & (cyp == 0) & (warm < 0.0) & (xx > INSET) & (yy > INSET) & (xx < W - INSET)
sky_pal, sky_w = palette(calm_sky, 14)
sky_cdf = np.cumsum(sky_w) / sky_w.sum()
hill_pal, _ = palette(region(640, 650, 1120, 770) & (sky_mask < 0.05), 8)
bush_pal, bush_w = palette((region(20, 890, 150, 1000) | region(600, 880, 720, 1000) | region(900, 760, 1150, 880)) & (lum < 0.42), 10)
cyp_dark = (cyp_core > 0) & (lum < 0.36) & (img[..., 2] < np.maximum(img[..., 0], img[..., 1]) + 0.04)
cyp_pal, cyp_w = palette(cyp_dark, 10)

# ----------------------------------------------------- the sky beyond the frame
KS = rng.normal(size=(3, 7, 3))
PH = rng.uniform(0, 6.28, size=(3, 7))


def noise3(p, ch=0):
    return np.sin(p @ KS[ch].T + PH[ch]).mean(-1) * 1.9


def ridge_ext(az):
    """Elevation of the hill line outside the painted window (radians)."""
    a = np.degrees(az)
    right_ = 2.0 + 9.0 * np.exp(-np.maximum(a - 32.5, 0) / 26.0)
    left_ = -1.2 + 3.0 * (1 - np.exp(-np.maximum(-32.5 - a, 0) / 18.0))
    base_ = np.where(a > 0, right_, left_)
    away = 1 - np.exp(-np.maximum(np.abs(a) - 32.5, 0) / 9.0)
    wob = 1.3 * np.sin(az * 5 + 1.0) + 0.8 * np.sin(az * 11 + 4.0) + 0.5 * np.sin(az * 23)
    return np.radians(base_ + wob * away)


# More stars, each one a copy of a star in the painting (centre x, y, radius).
STAR_SRC = [(300, 175, 60), (905, 235, 62), (415, 330, 42), (770, 90, 62), (525, 65, 40)]
stars = []
srng = np.random.default_rng(11)
while len(stars) < 17:
    az = srng.uniform(-np.pi, np.pi)
    el = np.arcsin(srng.uniform(np.sin(np.radians(9)), np.sin(np.radians(80))))
    c = np.array([np.sin(az) * np.cos(el), np.sin(el), -np.cos(az) * np.cos(el)])
    px_, py_, v_ = project(c[None])
    if v_[0] and -90 * SX < px_[0] < W + 90 * SX and -90 * SX < py_[0] < H:
        continue
    if any(np.arccos(np.clip(c @ s["c"], -1, 1)) < np.radians(24) for s in stars):
        continue
    e = norm(np.cross([0, 1, 0], c))
    stars.append(dict(c=c, e=e, n=np.cross(c, e), rot=srng.uniform(0, 6.28), src=STAR_SRC[len(stars) % len(STAR_SRC)]))


# ------------------------------------------------- the land's skyline all round
NA = 1024
def line_to_az_el(points):
    pts = np.array(points, np.float32) * SX
    xs = np.arange(pts[0, 0], pts[-1, 0])
    dd = unproject(xs, np.interp(xs, pts[:, 0], pts[:, 1]))
    return np.arctan2(dd[:, 0], -dd[:, 2]), np.arcsin(dd[:, 1])


az_t = (np.arange(NA) + 0.5) / NA * 2 * np.pi - np.pi
# nearer hills: the blue hills behind the village, and the low hills on the left
a1, e1 = line_to_az_el([(14, 735), (100, 750), (190, 760), (480, 742), (520, 702), (560, 690), (610, 700), (650, 716),
                        (700, 700), (760, 652), (840, 634), (900, 650), (950, 664), (1000, 652), (1100, 640),
                        (1200, 626), (1266, 616)])
# far mountains: the dark Alpilles on the right
a2, e2 = line_to_az_el([(900, 668), (1000, 640), (1100, 600), (1150, 570), (1172, 526), (1210, 518), (1266, 514)])
# Beyond the frame the skyline is the real one round Saint-Paul-de-Mausole
# (tools/starry/skyline.py): the Alpilles to the south-east, plain to the north
# and west. The painting looks a little south of east. He painted the
# mountains about half again as tall as they are, so the real ones are raised
# to match; and the low horizon is lifted into gentle rolling hills.
VIEW_BEARING = np.radians(100.0)
_real = np.load(ROOT / "reference" / "real_skyline.npy").astype(np.float64)
real = np.interp(az_t + VIEW_BEARING, np.arange(len(_real) + 1) / len(_real) * 2 * np.pi,
                 np.append(_real, _real[0]), period=2 * np.pi)
real = np.maximum(real, 0) * 1.55
rolling = np.radians(1.5 + 0.55 * np.sin(az_t * 5 + 1.0) + 0.35 * np.sin(az_t * 11 + 4.0) + 0.2 * np.sin(az_t * 23))
near_out = np.maximum(np.minimum(real, np.radians(3.4)), rolling)
JOIN = np.radians(14.0)
w_l = smoothstep(0, JOIN, a1[0] - az_t)
w_r = smoothstep(0, JOIN, az_t - a1[-1])
el1 = np.interp(az_t, a1, e1)
el1 = np.where(az_t < a1[0], e1[0] * (1 - w_l) + near_out * w_l, el1)
el1 = np.where(az_t > a1[-1], e1[-1] * (1 - w_r) + near_out * w_r, el1)
el2 = np.full(NA, -1.0)
inside2 = (az_t >= a2[0]) & (az_t <= a2[-1])
el2[inside2] = np.interp(az_t[inside2], a2, e2)
w_r2 = smoothstep(0, JOIN, az_t - a2[-1])
el2 = np.where(az_t > a2[-1], e2[-1] * (1 - w_r2) + real * w_r2, el2)
el2 = np.where(az_t < a1[0], real * w_l, el2)
el2 = np.where(el2 > el1 + np.radians(0.4), el2, -1.0)
EL1 = el1.copy()
EL_TOP = np.where(el2 > -0.5, np.maximum(el1, el2), el1)
EL_BASE = np.radians(-3.2)      # foot of the hills, seen from the viewpoint


def el_top(az):
    return np.interp(az, az_t, EL_TOP, period=2 * np.pi)


def dirs(az, el):
    return np.stack([np.sin(az) * np.cos(el), np.sin(el), -np.cos(az) * np.cos(el)], -1)


# The painted hills are carried on round the horizon by folding the painted
# span back and forth (a mirror at each end), so beyond the frame the hills
# are still his paint, and the join is exact.
_fold = unproject(np.array([500 * SX, W - INSET - FEATHER / 2]), np.array([HORIZON_Y, HORIZON_Y]))   # right of the cypress, where the hills are tall
AZ_L, AZ_R = np.arctan2(_fold[:, 0], -_fold[:, 2])

_hr = np.random.default_rng(7)
HATCH = [(int(k), float(sl), float(ph)) for k, sl, ph in zip(_hr.integers(30, 150, 7), _hr.uniform(0.5, 0.95, 7), _hr.uniform(0, 6.28, 7))]

_g = unproject(np.array([770 * SX, 1250 * SX]), np.array([HORIZON_Y, HORIZON_Y]))
GZ_L, GZ_R = np.arctan2(_g[:, 0], -_g[:, 2])
GROVE_TOP, GROVE_H = np.radians(-0.8), np.radians(4.0)

LIC = None
FLOW_S = None


def field(d, colour_img, jitter=None, land=False):
    """Colour, travel direction (3D tangent), speed 0..1 for sky directions d."""
    n_ = len(d)
    az = np.arctan2(d[:, 0], -d[:, 2])
    el = np.arcsin(np.clip(d[:, 1], -1, 1))

    # --- invented continuation (in his vocabulary: blue dashes, light on dark)
    jit = 0.0 if jitter is None else (jitter - 0.5)
    pl = norm(np.array([-np.cos(0.26), -np.sin(0.26), 0.0]))  # the flow rises from below
    pr = norm(np.array([np.cos(0.26), -np.sin(0.26), 0.0]))   # the hills, left to right
    vl, vr = d - pl, pr - d
    t0 = vl / (vl * vl).sum(-1, keepdims=True) + vr / (vr * vr).sum(-1, keepdims=True)
    t0 = norm(t0 - (t0 * d).sum(-1, keepdims=True) * d)
    ang = 0.75 * noise3(d * 2.2, 0) + 0.25 * noise3(d * 5.0, 1)
    t_ext = norm(t0 * np.cos(ang)[:, None] + np.cross(d, t0) * np.sin(ang)[:, None])

    # The painting's currents carry on past its frame and settle gradually:
    # each place outside takes the direction and tone of the nearest painted
    # sky, less and less the further away it is.
    pxa, pya, _ = project(d)
    front = (d @ CAM_F) > 0.2
    cx = np.where(front, np.clip(pxa, INSET + FEATHER, W - INSET - FEATHER), W / 2)
    cy = np.where(front, np.clip(pya, INSET + FEATHER, H - INSET - FEATHER), H / 2)
    dc = unproject(cx, cy)
    apart = np.arccos(np.clip((dc * d).sum(-1), -1, 1))
    w_x = np.exp(-apart / np.radians(20)) * front * samp(sky_mask, cx, cy)
    l2 = samp(line, cx, cy)
    l2 = norm(l2) * np.sign((l2 * samp(arrow, cx, cy)).sum(-1, keepdims=True) + 1e-6)
    tc = norm(unproject(cx + l2[:, 0] * 2, cy + l2[:, 1] * 2) - dc)
    tc = norm(tc - (tc * d).sum(-1, keepdims=True) * d)
    t_ext = norm(t_ext * (1 - w_x)[:, None] + tc * w_x[:, None])
    edge_col = samp(scene_soft, cx, cy)
    if FLOW_S is not None:  # the same directions, with corners and creases eased out
        ts = eq_sample(FLOW_S, d)
        t_ext = norm(ts - (ts * d).sum(-1, keepdims=True) * d)

    # Light and dark run in bands along the currents (see LIC below).
    band = eq_sample(LIC, d) if LIC is not None else np.full(n_, 0.5, np.float32)
    u = np.clip(0.4 + (band - 0.5) * 0.8 + jit * 0.42, 0.001, 0.999)
    c_sky = sky_pal[np.searchsorted(sky_cdf, u).clip(0, len(sky_pal) - 1)]
    if jitter is None:  # undercoat: a calmer version, the strokes carry the contrast
        lo = sky_pal[np.searchsorted(sky_cdf, 0.12)]
        hi = sky_pal[np.searchsorted(sky_cdf, 0.6)]
        c_sky = lo + (hi - lo) * band[:, None]
    glow = (0.6 * w_x ** 2)[:, None]
    c_sky = c_sky * (1 - glow) + edge_col * glow
    r_el = el_top(az)
    # Hills beyond the frame wear the painted hills' own paint (colour and
    # stroke direction), taken from the part of the painting where the hills
    # stand tall. The source is walked back and forth along that span, with
    # the turning points bent so they follow the slope instead of standing as
    # straight vertical seams. Paint is laid by depth below the ridge and is
    # never stretched by more than a little, which is what smeared it into
    # bands before; where the source runs out it is folded back up.
    top_here = r_el
    depth = np.maximum(top_here - el, -np.radians(0.3))
    u_ = (az - AZ_L) / (AZ_R - AZ_L) + 0.07 * np.sin(depth * 55 + az * 2.0) + 0.04 * np.sin(depth * 120 - az * 5.0)
    tri = 1 - np.abs(1 - np.mod(u_, 2))
    flipped = np.mod(np.floor(u_), 2) != 0
    az_m = AZ_L + tri * (AZ_R - AZ_L)
    top_src = el_top(az_m)
    room_src = np.maximum(top_src - EL_BASE, np.radians(1.0))
    room_here = np.maximum(top_here - EL_BASE, np.radians(1.0))
    depth_s = depth * np.clip(room_src / room_here, 0.75, 1.35)
    over = np.mod(np.maximum(depth_s, 0), 2 * room_src)
    depth_s = np.where(depth_s > room_src, room_src - np.abs(over - room_src), depth_s)
    d_m = dirs(az_m, top_src - depth_s)
    pxm, pym, _ = project(d_m)
    pym = np.maximum(pym, np.interp(pxm, np.arange(W), ridge_y) + 9 * SX)      # never the sky
    hill_img = hills_soft if colour_img is scene_soft else hills_fine
    c_hill = samp(hill_img, pxm, pym)
    # The valley floor beyond the frame wears the paint of his groves: the
    # swirling blue-green bushes between the village and the hills. That band
    # is walked along and folded up and down, row after row toward you.
    below = np.maximum(EL_BASE - el, 0)
    u2 = (az - GZ_L) / (GZ_R - GZ_L) + 0.09 * np.sin(below * 38 + az * 3.0) + 0.05 * np.sin(below * 90 - az * 7.0)
    tri2 = 1 - np.abs(1 - np.mod(u2, 2))
    flip2 = np.mod(np.floor(u2), 2) != 0
    az_g = GZ_L + tri2 * (GZ_R - GZ_L)
    vv = GROVE_H - np.abs(np.mod(below * 0.8, 2 * GROVE_H) - GROVE_H)
    d_g = dirs(az_g, GROVE_TOP - vv)
    pxg, pyg, _ = project(d_g)
    pyg = np.maximum(pyg, np.interp(pxg, np.arange(W), ridge_y) + 9 * SX)
    w_low = smoothstep(0.0, np.radians(1.2), below)
    c_land = c_hill + (samp(hill_img, pxg, pyg) - c_hill) * w_low[:, None]
    is_sky = smoothstep(-0.006, 0.006, el - r_el)
    use_g = w_low > 0.5
    pxm, pym, d_m, az_m = np.where(use_g, pxg, pxm), np.where(use_g, pyg, pym), np.where(use_g[:, None], d_g, d_m), np.where(use_g, az_g, az_m)
    flipped = np.where(use_g, flip2, flipped)
    lm = samp(line, pxm, pym)
    t_m = norm(unproject(pxm + lm[:, 0] * 2, pym + lm[:, 1] * 2) - d_m)
    east_m = np.stack([np.cos(az_m), np.zeros(n_), np.sin(az_m)], -1)
    ce = (t_m * east_m).sum(-1) * np.where(flipped, -1.0, 1.0)
    cn = (t_m * np.cross(d_m, east_m)).sum(-1)
    east = np.stack([np.cos(az), np.zeros(n_), np.sin(az)], -1)
    t_land = norm(ce[:, None] * east + cn[:, None] * np.cross(d, east))
    t_ext = np.where(is_sky[:, None] > 0.5, t_ext, t_land)
    c_ext = c_land + (c_sky - c_land) * is_sky[:, None]
    s_ext = is_sky.copy()

    # --- extra stars
    for s in stars:
        cz = d @ s["c"]
        rad = s["src"][2] * SX / F
        near = cz > np.cos(rad * 1.05)
        if not near.any():
            continue
        dn = d[near]
        x = (dn @ s["e"]) / cz[near]
        y = (dn @ s["n"]) / cz[near]
        cr, sr = np.cos(s["rot"]), np.sin(s["rot"])
        xs, ys = x * cr - y * sr, x * sr + y * cr
        px, py = s["src"][0] * SX + xs * F, s["src"][1] * SX - ys * F
        wgt_ = 1 - smoothstep(0.62, 1.0, np.hypot(x, y) / rad)
        col = samp(colour_img, px, py)
        l2 = samp(line, px, py)
        l2 *= np.sign((l2 * samp(arrow, px, py)).sum(-1, keepdims=True) + 1e-6)
        fx, fy = l2[:, 0], -l2[:, 1]
        fx, fy = fx * cr + fy * sr, -fx * sr + fy * cr
        t3 = norm(fx[:, None] * s["e"] + fy[:, None] * s["n"])
        t3 = norm(t3 - (t3 * dn).sum(-1, keepdims=True) * dn)
        c_ext[near] += (col - c_ext[near]) * wgt_[:, None]
        t_ext[near] = norm(t_ext[near] * (1 - wgt_)[:, None] + t3 * wgt_[:, None])

    # --- the painting itself
    px, py, valid = project(d)
    edge = np.minimum.reduce([px - INSET, W - INSET - px, py - INSET, H - INSET - py])
    w_p = smoothstep(0, FEATHER, edge) * valid
    # Land hidden by the cypress has no paint of its own on the canvas: it is painted like the
    # hills beyond the frame, with the painted hills' paint walked along, not with a filled-in guess.
    w_p = np.where(valid & (el < r_el) & (samp(cyp_in, np.clip(px, 0, W - 1), np.clip(py, 0, H - 1)) > 0.5), 0.0, w_p)
    inside = w_p > 0
    colour = c_ext
    t = t_ext
    speed = s_ext
    if inside.any():
        pxi, pyi = px[inside], py[inside]
        if land:   # ground that stands a little above the painted skyline still takes land paint
            pyi = np.maximum(pyi, np.interp(pxi, np.arange(W), ridge_y) + 5 * SX)
        col = samp(hill_img if land else colour_img, pxi, pyi)   # land: the hills without the painted spire (the church is now a real building)
        l2 = samp(line, pxi, pyi)
        a2 = samp(arrow, pxi, pyi)
        sgn = np.sign((l2 * a2).sum(-1, keepdims=True) + 1e-6)
        l2 = norm(l2) * sgn
        d2 = unproject(pxi + l2[:, 0] * 2, pyi + l2[:, 1] * 2)
        t3 = norm(d2 - d[inside])
        sm = samp(sky_mask, pxi, pyi)
        sp = sm * np.clip(np.linalg.norm(a2, axis=-1) * 1.25, 0, 1) * (0.0 if land else 1.0)
        wi = w_p[inside][:, None]
        colour[inside] = c_ext[inside] * (1 - wi) + col * wi
        t[inside] = norm(t_ext[inside] * (1 - wi) + t3 * wi)
        speed[inside] = s_ext[inside] * (1 - wi[:, 0]) + sp * wi[:, 0]
    land_in_window = inside & (speed < 0.3) & (w_p > 0.5)
    return colour.astype(np.float32), t.astype(np.float32), speed.astype(np.float32), land_in_window


def eq_sample(grid, d):
    """Look up a sky map (azimuth across, elevation down) in directions d."""
    gh_, gw_ = grid.shape[:2]
    x = (np.arctan2(d[:, 0], -d[:, 2]) + np.pi) / (2 * np.pi) * gw_ - 0.5
    y = np.clip((np.pi / 2 - np.arcsin(np.clip(d[:, 1], -1, 1))) / (np.pi / 2 - EL_MIN) * gh_ - 0.5, 0, gh_ - 1.001)
    x0 = np.floor(x).astype(np.int64)
    y0 = y.astype(np.int64)
    fx, fy = x - x0, y - y0
    if grid.ndim == 3:
        fx, fy = fx[:, None], fy[:, None]
    xa, xb = x0 % gw_, (x0 + 1) % gw_
    top = grid[y0, xa] * (1 - fx) + grid[y0, xb] * fx
    bot = grid[y0 + 1, xa] * (1 - fx) + grid[y0 + 1, xb] * fx
    return (top * (1 - fy) + bot * fy).astype(np.float32)


# ------------------------------------------ bands of light and dark (LIC)
# In the painting, light and dark strokes lie in bands that follow the
# currents. To continue that beyond the frame, tone is smeared along the flow
# (line integral convolution). Inside the frame the tone smeared is the
# painting's own, so its bands run on out of the frame along the currents.
GW, GH = 1440, 480
gaz, gel = np.meshgrid((np.arange(GW) + 0.5) / GW * 2 * np.pi - np.pi,
                       np.pi / 2 - (np.arange(GH) + 0.5) / GH * (np.pi / 2 - EL_MIN))
gd = dirs(gaz.ravel(), gel.ravel())
_, gt0, _, _ = field(gd, scene_fine)
PAD = 40
g0 = gt0.reshape(GH, GW, 3)
g0 = np.concatenate([g0[:, -PAD:], g0, g0[:, :PAD]], 1)
FLOW_S = norm(cv2.GaussianBlur(g0, (0, 0), 11)[:, PAD:-PAD])
gcol, gt, gsp, _ = field(gd, scene_fine)
gpx, gpy, gvalid = project(gd)
gwp = smoothstep(0, FEATHER, np.minimum.reduce([gpx - INSET, W - INSET - gpx, gpy - INSET, H - INSET - gpy])) * gvalid
LUMW = np.array([0.299, 0.587, 0.114], np.float32)
tone_painting = np.interp(gcol @ LUMW, sky_pal @ LUMW, sky_cdf)
grain = noise3(gd * 60.0, 0) + noise3(gd * 95.0, 1)
grain = np.argsort(np.argsort(grain)) / len(grain)
seed_g = (tone_painting * gwp + grain * (1 - gwp)).astype(np.float32).reshape(GH, GW)
live_g = (gsp > 0.3).astype(np.float32).reshape(GH, GW)
flow_g = (gt * (gsp > 0.3)[:, None]).reshape(GH, GW, 3)
KSTEP, HSTEP = 22, np.radians(0.5)
acc = seed_g.ravel().copy()
wsum = np.ones(len(gd), np.float32)
for sgn in (1.0, -1.0):
    p_ = gd.copy()
    for k in range(1, KSTEP + 1):
        p_ = norm(p_ + sgn * eq_sample(flow_g, p_) * HSTEP)
        wk = (0.5 + 0.5 * np.cos(np.pi * k / (KSTEP + 1))) * eq_sample(live_g, p_)
        acc += eq_sample(seed_g, p_) * wk
        wsum += wk
lic = acc / wsum
is_live = gsp > 0.3
rank = np.full(len(gd), 0.5, np.float32)
rank[is_live] = np.argsort(np.argsort(lic[is_live])) / max(is_live.sum(), 1)
LIC = cv2.GaussianBlur(rank.reshape(GH, GW), (0, 0), 0.8)

# ------------------------------------------------------------------ undercoat
UW, UH = 4096, 1366
az_g, el_g = np.meshgrid((np.arange(UW) + 0.5) / UW * 2 * np.pi - np.pi,
                         np.pi / 2 - (np.arange(UH) + 0.5) / UH * (np.pi / 2 - EL_MIN))
under = np.zeros((UH, UW, 3), np.float32)
for r0 in range(0, UH, 128):
    dd = dirs(az_g[r0:r0 + 128].ravel(), el_g[r0:r0 + 128].ravel())
    c, _, _, _ = field(dd, scene_soft)
    under[r0:r0 + 128] = c.reshape(-1, UW, 3)
under = cv2.GaussianBlur(under, (0, 0), 2.0)
cv2.imwrite(str(OUT / "sky_under.jpg"), (np.clip(under[:, :, ::-1], 0, 1) * 255).astype(np.uint8),
            [cv2.IMWRITE_JPEG_QUALITY, 90])


# --------------------------------------------------------------------- strokes
def bake(d, scale, travel_lengths):
    """Turn sample directions into strokes: 20 floats each."""
    n_ = len(d)
    col, t, speed, _ = field(d, scene_fine, rng.uniform(0, 1, n_))
    length = np.radians(rng.uniform(1.8, 3.7, n_)) * scale
    width = np.radians(rng.uniform(0.45, 0.78, n_)) * scale
    # The path a stroke lies on and travels along is a circle on the sky dome
    # fitted to the measured flow through three points.
    def step(sign):
        p1 = norm(d + sign * t * (length / 2)[:, None])
        _, t1, _, _ = field(p1, scene_fine)
        t1 *= np.sign((t1 * t).sum(-1, keepdims=True) + 1e-6)
        tm = norm(t + t1)
        return norm(d + sign * tm * (length / 2)[:, None])
    pp, pm = step(1.0), step(-1.0)
    axis = np.cross(d - pm, pp - d)
    weak = np.linalg.norm(axis, axis=-1) < 1e-7
    axis[weak] = np.cross(d[weak], t[weak])
    axis = norm(axis)
    axis *= np.sign((np.cross(axis, d) * t).sum(-1, keepdims=True) + 1e-9)
    sinc = np.sqrt(np.clip(1 - (axis * d).sum(-1) ** 2, 1e-4, 1))
    length = np.minimum(length, 1.7 * sinc)
    body = length / sinc
    travel = travel_lengths * length * speed / sinc
    side = norm(np.cross(d, t))
    col2, _, _, _ = field(norm(d + side * (width * 0.7)[:, None]), scene_fine, rng.uniform(0, 1, n_))
    warm_ = np.clip(((col[:, 0] + col[:, 1]) / 2 - col[:, 2] + 0.02) / 0.22, 0, 1) * smoothstep(0.45, 0.7, col.max(-1))
    out = np.zeros((n_, 20), np.float32)
    out[:, 0:3], out[:, 3] = d, body
    out[:, 4:7], out[:, 7] = axis, travel
    out[:, 8:11], out[:, 11] = col, width
    out[:, 12:15], out[:, 15] = col2, rng.uniform(0, 1, n_)
    out[:, 16] = warm_
    out[:, 17] = noise3(d * 5.0, 0)
    out[:, 18] = rng.integers(0, 8, n_)
    out[:, 19] = speed
    return out


def uniform_dirs(n_):
    az = rng.uniform(-np.pi, np.pi, n_)
    el = np.arcsin(rng.uniform(np.sin(EL_MIN), 1, n_))
    return dirs(az, el)


def warmth(d):
    """How much a place is star or moon (0..1): those are painted in small dabs."""
    c, _, _, _ = field(d, scene_soft)
    return np.clip(((c[:, 0] + c[:, 1]) / 2 - c[:, 2] - 0.03) / 0.2, 0, 1)


N_ALL = 66000
d_all = uniform_dirs(N_ALL)
_, _, sp_all, _ = field(d_all, scene_fine)
moving = sp_all > 0.3
sky = bake(d_all[moving], 1.0 - 0.5 * warmth(d_all[moving]), 2.6)
still = d_all[~moving][: int((~moving).sum() * 0.5)]
# stars and moon: a second coat of small dabs that circle with the halos
cand = uniform_dirs(700000)
_, _, sp_c, _ = field(cand, scene_fine)
cand = cand[(warmth(cand) > 0.4) & (sp_c > 0.3)]
stars_fine = bake(cand[:11000], 0.42, 2.2)
sky.tofile(OUT / "sky_strokes.bin")
stars_fine.tofile(OUT / "land_strokes.bin")  # (name kept: drawn after the sky)

# ======================================================================
# The valley: land you can stand on, whose outlines match the painting
# ======================================================================
# From the viewpoint, each hill line in the painting sits at a known angle
# above eye level. Give each line a distance and the angle becomes a height.
# The ground is then: the viewpoint knoll, a valley floor, a ring of nearer
# hills and, to the right, the far mountains. src/worlds/starry/terrain.ts
# holds the same formulas; keep the two in step.
EYE = np.array([0.0, 1.6, 0.0])
FLOOR = -28.0       # valley floor below the knoll top; sets the church spire near 40 m


def knoll(x, z):
    d = np.hypot(x, z)
    fwd = -z / np.maximum(d, 1e-3)
    slope = 0.07 + 0.29 * smoothstep(-0.2, 0.75, fwd)
    # In front, the hill falls as one even tilted plane (measured straight
    # ahead, not outward from the top), so the field on it is not a bulge.
    de = d + (np.maximum(-z, 0) - d) * smoothstep(0.35, 0.7, fwd)
    q = np.maximum(de - 4, 0)
    f = np.where(q < 4, q * q / 8, q - 2)
    und = 0.12 * np.sin(x * 0.31 + 1.3) * np.sin(z * 0.27) + 0.05 * np.sin(x * 1.1) * np.sin(z * 0.9 + 2)
    return -slope * f + und * smoothstep(3, 8, d)


def bump(d, D, start):
    return smoothstep(start * D, D, d) * (1 - 0.75 * smoothstep(D, 1.5 * D, d))


# Where each range begins to rise, as a share of its distance. The painted
# hills are a band above the village, not a long ramp from the valley floor.
RISE_1, RISE_2 = 0.78, 0.6


def smax(a, b, k):
    h = np.clip(0.5 + 0.5 * (a - b) / k, 0, 1)
    return b * (1 - h) + a * h + k * h * (1 - h)


D1 = 700 + 120 * np.sin(az_t * 3 + 1.0)
D2 = 1600 + 200 * np.sin(az_t * 2)
h1 = np.maximum(EYE[1] + D1 * np.tan(el1) - FLOOR, 0)
h2 = np.where(el2 > -0.5, np.maximum(EYE[1] + D2 * np.tan(np.maximum(el2, -0.5)) - FLOOR, 0), 0)
ridge_tab = np.stack([h1, D1, h2, D2], -1).astype(np.float32)
for ch in (0, 2):
    col_ = np.concatenate([ridge_tab[-8:, ch], ridge_tab[:, ch], ridge_tab[:8, ch]])
    ridge_tab[:, ch] = np.convolve(col_, np.ones(3) / 3, mode="same")[8:-8]
ridge_tab.tofile(OUT / "ridge.bin")


def ridge_at(az):
    u = (az + np.pi) / (2 * np.pi) * NA - 0.5
    i0 = np.floor(u).astype(np.int64)
    f = (u - i0)[..., None]
    return ridge_tab[i0 % NA] * (1 - f) + ridge_tab[(i0 + 1) % NA] * f


def terrain_np(x, z):
    d = np.hypot(x, z)
    floor = FLOOR + 1.2 * np.sin(x * 0.013 + 0.5) * np.sin(z * 0.011 + 1.0)
    base = smax(knoll(x, z), floor, 3.0)
    r = ridge_at(np.arctan2(x, -z))
    return base + np.maximum(r[..., 0] * bump(d, r[..., 1], RISE_1), r[..., 2] * bump(d, r[..., 3], RISE_2))


T_STEPS = 2.0 * (4000 / 2.0) ** (np.arange(240) / 239)


def cast(d):
    """Distance from the eye to the ground along directions d (nan = sky)."""
    out = np.full(len(d), np.nan)
    for i0 in range(0, len(d), 20000):
        dd = d[i0:i0 + 20000]
        t = T_STEPS[None, :]
        gap = EYE[1] + t * dd[:, 1:2] - terrain_np(t * dd[:, 0:1], t * dd[:, 2:3])
        below = gap < 0
        hit = below.any(1)
        k = np.clip(below.argmax(1), 1, None)
        lo, hi = T_STEPS[k - 1], T_STEPS[k]
        for _ in range(14):
            mid = (lo + hi) / 2
            under = EYE[1] + mid * dd[:, 1] - terrain_np(mid * dd[:, 0], mid * dd[:, 2]) < 0
            hi = np.where(under, mid, hi)
            lo = np.where(under, lo, mid)
        out[i0:i0 + 20000] = np.where(hit, hi, np.nan)
    return out


def ground_normal(P):
    e = 0.5
    nx = terrain_np(P[:, 0] - e, P[:, 2]) - terrain_np(P[:, 0] + e, P[:, 2])
    nz = terrain_np(P[:, 0], P[:, 2] - e) - terrain_np(P[:, 0], P[:, 2] + e)
    return norm(np.stack([nx, np.full(len(P), 2 * e), nz], -1))


def lay_on_ground(d, scale, zone):
    """The painting's land strokes, set on the ground where the viewpoint sees
    them. A stroke lying flat on far ground would be seen almost edge-on and
    break up, so each is tipped up toward the viewpoint just enough to be seen
    at a fair angle (like a dab on a bush rather than a stain on the earth).
    From the viewpoint they look exactly as painted."""
    n_ = len(d)
    col, t3, _, _ = field(d, scene_fine, rng.uniform(0, 1, n_), land=True)
    side = norm(np.cross(d, t3))
    col2, _, _, _ = field(norm(d + side * np.radians(0.45) * scale), scene_fine, rng.uniform(0, 1, n_), land=True)
    t0 = cast(d)
    ok_ = np.isfinite(t0) & (t0 < 3500)
    t0 = np.where(ok_, t0, 1.0)
    P = EYE + t0[:, None] * d
    far_ground = np.hypot(P[:, 0], P[:, 2]) > HILLS_FROM
    ok_ &= far_ground if zone == 'hills' else ~far_ground
    N = ground_normal(P)
    # Only on the valley floor and knoll. On the far hills a tipped stroke
    # would stand above the ridge like a sail when seen from the valley.
    want = 0.62 * (1 - smoothstep(330.0, 480.0, t0))
    k = np.zeros(n_)
    for _ in range(12):
        Nf = norm(N - d * k[:, None])
        k = np.where(-(Nf * d).sum(-1) < want, k + 0.25, k)
    Nf = norm(N - d * k[:, None])
    T = norm(t3 - d * ((t3 * Nf).sum(-1) / (d * Nf).sum(-1))[:, None])
    B = norm(np.cross(Nf, T))
    # Widen a stroke seen at a slant so it still looks its painted size, but
    # never by much: a sliver on a far ridgeline must not become a giant.
    seen_t = np.sqrt(np.clip(1 - (T * d).sum(-1) ** 2, 0.2, 1))
    seen_b = np.sqrt(np.clip(1 - (B * d).sum(-1) ** 2, 0.2, 1))
    ok_ &= -(Nf * d).sum(-1) > 0.1      # ground seen edge-on is left to the broad coat
    length = np.radians(rng.uniform(1.8, 3.7, n_)) * scale * t0 / seen_t
    width = np.radians(rng.uniform(0.45, 0.78, n_)) * scale * t0 / seen_b
    rise = 0.05 + 0.5 * (np.abs(T[:, 1]) * length / 2 + np.abs(B[:, 1]) * width * 0.68)
    root = P + np.array([0.0, 1, 0]) * rise[:, None] - T * (length / 2)[:, None]
    out = np.zeros((n_, 24), np.float32)
    out[:, 0:3], out[:, 3] = root, length
    out[:, 4:7], out[:, 7] = T, width
    out[:, 8:11], out[:, 11] = Nf, 0.0
    out[:, 12:15], out[:, 15] = col, rng.uniform(0, 1, n_)
    out[:, 16:19], out[:, 19] = col2, rng.integers(0, 8, n_)
    out[:, 22] = rng.uniform(-0.04, 0.04, n_)
    return out[ok_]


HILLS_FROM = 430.0   # metres from the viewpoint: beyond this the land is "the hills"


def valley_dirs(coverage, scale):
    """Directions from the viewpoint over the valley floor outside the frame."""
    lo, hi = np.radians(-17.0), EL_BASE + np.radians(0.4)
    n_ = int(coverage * 360.0 * np.degrees(hi - lo) / (2.75 * 0.61 * 0.75 * scale * scale))
    dd = dirs(rng.uniform(-np.pi, np.pi, n_), rng.uniform(lo, hi, n_))
    px, py, v = project(dd)
    inside = v & (px > INSET + FEATHER) & (px < W - INSET - FEATHER) & (py < H - INSET - FEATHER)
    return dd[~inside]


def hill_dirs(coverage, scale):
    """Directions from the viewpoint spread evenly over the band of hills, all
    the way round, enough for `coverage` coats of strokes at this scale."""
    top = EL_TOP + np.radians(0.25)
    lo = EL_BASE - np.radians(2.0)
    area_deg2 = np.degrees(top - lo).sum() * 360.0 / NA
    n_ = int(coverage * area_deg2 / (2.75 * 0.61 * 0.75 * scale * scale))
    az = rng.uniform(-np.pi, np.pi, n_ * 2)
    el = rng.uniform(lo, np.radians(13), n_ * 2)
    keep = el < el_top(az) + np.radians(0.25)
    return dirs(az[keep], el[keep])[:n_]


def lay_unseen(count, radius):
    """Ground the viewpoint cannot see (the knoll's flanks, dips): his dark
    field colours in broad strokes that run along the slope's contours."""
    rad = radius * np.sqrt(rng.uniform(0.0004, 1, count * 5))
    ang = rng.uniform(0, 2 * np.pi, count * 5)
    x, z = rad * np.sin(ang), -rad * np.cos(ang)
    P = np.stack([x, terrain_np(x, z), z], -1)
    to_ = P - EYE
    dist = np.linalg.norm(to_, axis=-1)
    hidden = ~(cast(to_ / dist[:, None]) > dist * 0.97)
    P = P[hidden][:count]
    n_ = len(P)
    e = 0.5
    nx = terrain_np(P[:, 0] - e, P[:, 2]) - terrain_np(P[:, 0] + e, P[:, 2])
    nz = terrain_np(P[:, 0], P[:, 2] - e) - terrain_np(P[:, 0], P[:, 2] + e)
    N = norm(np.stack([nx, np.full(n_, 2 * e), nz], -1))
    contour = norm(np.cross(N, np.array([0.0, 1, 0])) + 1e-4)
    turn_ = rng.normal(0, 0.35, n_)
    T = norm(contour * np.cos(turn_)[:, None] + np.cross(N, contour) * np.sin(turn_)[:, None])
    w_ = bush_w * (np.arange(len(bush_w)) < 6)
    pick = lambda: bush_pal[rng.choice(len(bush_pal), n_, p=w_ / w_.sum())]
    out = np.zeros((n_, 24), np.float32)
    out[:, 0], out[:, 1], out[:, 2] = P[:, 0], 0.05, P[:, 2]
    out[:, 3] = rng.uniform(3.0, 7.0, n_)
    out[:, 4:7], out[:, 7] = T, rng.uniform(0.8, 1.6, n_)
    out[:, 8:11] = N
    out[:, 12:15], out[:, 15] = pick(), rng.uniform(0, 1, n_)
    out[:, 16:19], out[:, 19] = pick(), rng.integers(0, 8, n_)
    out[:, 22], out[:, 23] = rng.uniform(-0.08, 0.08, n_), 1.0
    return out


# The ground's own colour everywhere, seen from above in rings round the
# viewpoint: what the painting shows where the viewpoint can see it, his hill
# and field colours where it cannot. It is the undercoat of the land, and
# tints the fine strokes that appear where you walk.
R_MIN, R_MAX = 2.5, 3000.0
NR_V, NR, NA_C = 160, 2048, 4096


def ring_grid(nr, na):
    az_ = (np.arange(na) + 0.5) / na * 2 * np.pi - np.pi
    rr, aa = np.meshgrid(R_MIN * (R_MAX / R_MIN) ** (np.arange(nr) / (nr - 1)), az_, indexing="ij")
    gx_, gz_ = (rr * np.sin(aa)).ravel(), (-rr * np.cos(aa)).ravel()
    gp_ = np.stack([gx_, terrain_np(gx_, gz_), gz_], -1)
    to_ = gp_ - EYE
    dist_ = np.linalg.norm(to_, axis=-1)
    return gp_, to_ / dist_[:, None], dist_


gp, gdir, dist_ = ring_grid(NR_V, NA)
vis_lo = (cast(gdir) > dist_ * 0.97).reshape(NR_V, NA).astype(np.float32)
gp, gdir, dist_ = ring_grid(NR, NA_C)
# Sharp: this map IS the paint on flat ground. From the viewpoint it shows
# his strokes exactly as painted; nothing stands up and nothing fades.
seen_c = np.concatenate([field(gdir[i:i + 400000], scene_fine, land=True)[0] for i in range(0, len(gdir), 400000)])
visible = cv2.resize(vis_lo, (NA_C, NR), interpolation=cv2.INTER_LINEAR).ravel()[:, None]
hk = np.clip(0.6 + 0.3 * noise3(gp * 0.004, 1), 0, 0.999) * (len(hill_pal) - 1)
far_ = (np.hypot(gp[:, 0], gp[:, 2]) > 330)[:, None]     # hills are his hill blues; knoll and valley his dark greens
hidden_c = np.where(far_, hill_pal[hk.astype(int)], bush_pal[(hk * 0.6).astype(int)])
ground_col = (seen_c * visible + hidden_c * (1 - visible)).reshape(NR, NA_C, 3).astype(np.float32)
cv2.imwrite(str(OUT / "ground_col.jpg"), (np.clip(ground_col[:, :, ::-1], 0, 1) * 255).astype(np.uint8),
            [cv2.IMWRITE_JPEG_QUALITY, 88])
ground_lo = cv2.resize(ground_col, (NA, NR_V), interpolation=cv2.INTER_AREA)

# hills and village inside the frame are painted with smaller strokes
cand = uniform_dirs(1500000)
px, py, v = project(cand)
cand = cand[v & (px > 0) & (px < W) & (py > 0) & (py < H)]
_, _, _, liw = field(cand, scene_fine)
cand = cand[liw]
# Broad coats first; each later coat is painted over the ones before.
broad = lay_unseen(16000, 330.0)
# THE HILLS: one piece, the same all the way round. Three coats, broad to
# fine, each several strokes deep like the sky. Inside the frame the colours
# and directions are the painting's; beyond it, the painting's carried on.
hills = np.concatenate([
    lay_on_ground(hill_dirs(2.2, 0.8), 0.8, 'hills'),
    lay_on_ground(hill_dirs(2.4, 0.5), 0.5, 'hills'),
    lay_on_ground(hill_dirs(1.4, 0.3), 0.3, 'hills'),
])
# THE VALLEY inside the frame (village, fields, bushes), as painted.
valley = np.concatenate([
    lay_on_ground(still, 1.0, 'valley'),
    lay_on_ground(cand[:7000], 0.5, 'valley'),
    lay_on_ground(cand[7000:25000], 0.27, 'valley'),
    lay_on_ground(cand[25000:51000], 0.16, 'valley'),
])
ground = np.concatenate([hills, valley])
broad.tofile(OUT / "terrain_broad.bin")
ground.tofile(OUT / "terrain_strokes.bin")
hills.tofile(OUT / "hill_strokes.bin")
print("unseen ground", len(broad), "hills", len(hills), "valley", len(valley), "hills up to", float(h1.max() + FLOOR), float(h2.max() + FLOOR), "m")


def hexes(p):
    return [[round(float(v), 4) for v in c] for c in p]


meta = dict(
    source="Vincent van Gogh, The Starry Night, 1889. Google Art Project scan (public domain).",
    hfovDeg=65.0, pitchDeg=float(np.degrees(PITCH)), aspect=W / H,
    sky=len(sky), land=len(stars_fine), stride=20,
    valley=dict(floor=FLOOR, rMin=R_MIN, rMax=R_MAX, strokes=len(ground) + len(broad)),
    under=dict(elMinDeg=-30.0),
    palettes=dict(cypress=hexes(cyp_pal), cypressWeight=[round(float(x), 4) for x in cyp_w],
                  bush=hexes(bush_pal), bushWeight=[round(float(x), 4) for x in bush_w],
                  hill=hexes(hill_pal), sky=hexes(sky_pal)),
)
(OUT / "starry.json").write_text(json.dumps(meta, indent=1))
print("sky strokes", len(sky), "star dabs", len(stars_fine), "pitch", np.degrees(PITCH))
cv2.imwrite(str(ROOT / "reference" / "debug_scene.jpg"), (scene[:, :, ::-1] * 255).astype(np.uint8))
hsv = np.zeros((H, W, 3), np.uint8)
hsv[..., 0] = ((np.arctan2(arrow[..., 1], arrow[..., 0]) + np.pi) / (2 * np.pi) * 179).astype(np.uint8)
hsv[..., 1] = 255
hsv[..., 2] = (np.clip(np.linalg.norm(arrow, axis=-1), 0, 1) * 255).astype(np.uint8)
cv2.imwrite(str(ROOT / "reference" / "debug_flow.jpg"), cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR))

dbg = (scene[:, :, ::-1] * 255).astype(np.uint8).copy()
for y in range(20, H, 26):
    for x in range(20, W, 26):
        v = arrow[y, x] * 11
        cv2.arrowedLine(dbg, (int(x - v[0]), int(y - v[1])), (int(x + v[0]), int(y + v[1])), (255, 255, 255), 1, cv2.LINE_AA, tipLength=0.45)
cv2.imwrite(str(ROOT / "reference" / "debug_arrows.jpg"), dbg)
