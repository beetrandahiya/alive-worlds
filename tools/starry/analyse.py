"""Measure The Starry Night and bake the data the sky is built from.

Reads   reference/starry_1280.jpg   (Google Art Project scan, public domain)
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
img8 = cv2.imread(str(ROOT / "reference" / "starry_1280.jpg"))
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
cyp = cv2.dilate(cyp, np.ones((int(15 * SX), int(15 * SX)), np.uint8))

RIDGE = np.array([
    (0, 735), (100, 750), (190, 760), (480, 742), (520, 702), (560, 690),
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
base = cv2.inpaint(img8, cyp, 9 * SX, cv2.INPAINT_TELEA)[:, :, ::-1].astype(np.float32) / 255
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
scene_soft = cv2.GaussianBlur(scene, (0, 0), 5.5 * SX)
scene_fine = cv2.GaussianBlur(scene, (0, 0), 1.1 * SX)

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
STEP = 8
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
bush_pal, bush_w = palette((region(20, 890, 150, 1000) | region(600, 880, 720, 1000) | region(900, 760, 1150, 880)), 10)
cyp_pal, cyp_w = palette(cyp_core > 0, 12)

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


def field(d, colour_img, jitter=None):
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
    ang = 0.5 * noise3(d * 2.2, 0) + 0.22 * noise3(d * 5.0, 1)
    t_ext = norm(t0 * np.cos(ang)[:, None] + np.cross(d, t0) * np.sin(ang)[:, None])
    u = np.clip(0.5 + 0.2 * noise3(d * 3.4, 2) + jit * 0.95, 0.001, 0.999)
    c_sky = sky_pal[np.searchsorted(sky_cdf, u).clip(0, len(sky_pal) - 1)]
    if jitter is None:  # undercoat: a calm mean, the strokes carry the contrast
        lo = sky_pal[np.searchsorted(sky_cdf, 0.3)]
        hi = sky_pal[np.searchsorted(sky_cdf, 0.62)]
        c_sky = lo + (hi - lo) * np.clip(0.5 + 0.5 * noise3(d * 3.4, 2), 0, 1)[:, None]
    r_el = ridge_ext(az)
    hk = np.clip(0.45 + 0.2 * noise3(d * 9.0, 1) + jit * 0.8, 0, 0.999) * (len(hill_pal) - 1)
    c_hill = hill_pal[hk.astype(int)]
    bk = np.clip(0.3 + 0.12 * noise3(d * 6.0, 2) + jit * 0.5, 0, 0.999) * 5
    c_low = bush_pal[bk.astype(int)]
    c_land = c_hill + (c_low - c_hill) * smoothstep(0.0, np.radians(7), r_el - el)[:, None]
    is_sky = smoothstep(-0.006, 0.006, el - r_el)
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
    inside = w_p > 0
    colour = c_ext
    t = t_ext
    speed = s_ext
    if inside.any():
        pxi, pyi = px[inside], py[inside]
        col = samp(colour_img, pxi, pyi)
        l2 = samp(line, pxi, pyi)
        a2 = samp(arrow, pxi, pyi)
        sgn = np.sign((l2 * a2).sum(-1, keepdims=True) + 1e-6)
        l2 = norm(l2) * sgn
        d2 = unproject(pxi + l2[:, 0] * 2, pyi + l2[:, 1] * 2)
        t3 = norm(d2 - d[inside])
        sm = samp(sky_mask, pxi, pyi)
        sp = sm * np.clip(np.linalg.norm(a2, axis=-1) * 1.25, 0, 1)
        wi = w_p[inside][:, None]
        colour[inside] = c_ext[inside] * (1 - wi) + col * wi
        t[inside] = norm(t_ext[inside] * (1 - wi) + t3 * wi)
        speed[inside] = s_ext[inside] * (1 - wi[:, 0]) + sp * wi[:, 0]
    land_in_window = inside & (speed < 0.3) & (w_p > 0.5)
    return colour.astype(np.float32), t.astype(np.float32), speed.astype(np.float32), land_in_window


def dirs(az, el):
    return np.stack([np.sin(az) * np.cos(el), np.sin(el), -np.cos(az) * np.cos(el)], -1)


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
    length = np.radians(rng.uniform(2.1, 4.3, n_)) * scale
    width = np.radians(rng.uniform(0.5, 0.85, n_)) * scale
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


N_ALL = 56000
d_all = uniform_dirs(N_ALL)
_, _, sp_all, _ = field(d_all, scene_fine)
moving = sp_all > 0.3
sky = bake(d_all[moving], 1.0, 2.6)
# static ground of the backdrop outside the window: fewer are needed
still = d_all[~moving][: int((~moving).sum() * 0.55)]
land_a = bake(still, 1.0, 0.0)
# hills and village inside the window are painted with smaller strokes
cand = uniform_dirs(900000)
px, py, v = project(cand)
cand = cand[v & (px > 0) & (px < W) & (py > 0) & (py < H)]
_, _, _, liw = field(cand, scene_fine)
land_b = bake(cand[liw][:9000], 0.5, 0.0)
land = np.concatenate([land_a, land_b])
sky.tofile(OUT / "sky_strokes.bin")
land.tofile(OUT / "land_strokes.bin")


def hexes(p):
    return [[round(float(v), 4) for v in c] for c in p]


meta = dict(
    source="Vincent van Gogh, The Starry Night, 1889. Google Art Project scan (public domain).",
    hfovDeg=65.0, pitchDeg=float(np.degrees(PITCH)), aspect=W / H,
    sky=len(sky), land=len(land), stride=20,
    under=dict(elMinDeg=-30.0),
    palettes=dict(cypress=hexes(cyp_pal), cypressWeight=[round(float(x), 4) for x in cyp_w],
                  bush=hexes(bush_pal), bushWeight=[round(float(x), 4) for x in bush_w],
                  hill=hexes(hill_pal), sky=hexes(sky_pal)),
)
(OUT / "starry.json").write_text(json.dumps(meta, indent=1))
print("sky strokes", len(sky), "land strokes", len(land), "pitch", np.degrees(PITCH))
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
