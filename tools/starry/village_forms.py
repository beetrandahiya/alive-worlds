"""The painted buildings as he drew them, face by face.

Each building is read off the 1280 px wide scan as the faces he actually
painted: a gable end and a long side meeting at a corner, a wall with a roof
slope above it, a tower. Every painted corner is followed along its line of
sight from the start until it meets the building's own planes, so the solid
form, seen from the start, has exactly his outline, skew and all. A face he
painted carries the paint he put on it; a face he could not see carries the
paint of its opposite face (wall for wall, roof for roof).

Writes public/starry/village_forms.json and reference/debug_village_forms.jpg.
Run: python3 tools/starry/village_forms.py
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
CP, SP = math.cos(PITCH), math.sin(PITCH)
EYE = np.array([0.0, 1.6, 0.0])
FLOOR = -28.0
LOW = 1009.0          # his paint ends here; below is the canvas's bare edge


def ray(px, py):
    x, y = (px - W / 2) / F, -(py - H / 2) / F
    d = np.array([x, y * CP + SP, -(CP - y * SP)])
    return d / np.linalg.norm(d)


def project(p):
    d = np.asarray(p, float) - EYE
    fwd = -d[2] * CP + d[1] * SP
    up = d[1] * CP + d[2] * SP
    return [W / 2 + F * d[0] / fwd, H / 2 - F * up / fwd]


def G(px, py):
    """Where the line of sight through a pixel meets the valley floor."""
    d = ray(px, py)
    return EYE + d * ((FLOOR - EYE[1]) / d[1])


def lift(p, py):
    """The point straight above p that the start sees at painting row py."""
    k = (H / 2 - py) / F
    z = p[2]
    dy = z * (SP + k * CP) / (k * SP - CP)
    return np.array([p[0], EYE[1] + dy, z])


def on_plane(px, py, q, n):
    """Where the line of sight through a pixel meets the upright plane through q with level normal n."""
    d = ray(px, py)
    return EYE + d * (np.dot(q - EYE, n) / np.dot(d, n))


def level(v):
    v = np.array([v[0], 0.0, v[2]])
    return v / np.linalg.norm(v)


def away(a, b):
    """Level unit normal of the upright plane through a and b, pointing away from the start."""
    t = level(b - a)
    n = np.array([-t[2], 0.0, t[0]])
    return n if np.dot(n, level((a + b) / 2)) > 0 else -n


def seen(p, low):
    u = project(p)
    return [u[0], min(u[1], low)]


buildings = []
_small = cv2.resize(img, (1280, int(round(H))), interpolation=cv2.INTER_AREA).astype(np.int32)
_lit = ((_small[..., 2] > 120) & (_small[..., 1] > 105) & (_small[..., 0] < 110) & (_small[..., 2] > _small[..., 0] + 40)).astype(np.uint8)
_lit = cv2.dilate(_lit, np.ones((5, 7), np.uint8)).astype(np.float32)   # and the glow round each lamp


def calm(x0, x1, y0, y1):
    """The stretch of a painted wall with no lit window in it (at least 45% of the wall), for the
    walls he could not see: a lamp he painted in one window must not shine from every side."""
    lo, hi = sorted((x0, x1))
    w = max(0.3 * (hi - lo), min(hi - lo, 8.0))
    ya, yb = int(min(y0, y1)), int(max(y0, y1)) + 1
    best = None
    for a in np.arange(lo, hi - w + 0.01, 1.0):
        n = _lit[ya:yb, int(a):int(a + w) + 1].sum() + 0.01 * abs(a + w / 2 - (lo + hi) / 2)
        if best is None or n < best[0]:
            best = (n, a)
    return best[1], best[1] + w



def face(kind, pts, uv):
    return {"kind": kind, "p": [[round(float(c), 3) for c in p] for p in pts], "uv": [[round(float(c), 2) for c in u] for u in uv]}


def finish(name, faces, corners, lit=0):
    c = np.mean(corners, 0)
    for f in faces:   # outward normal
        p = np.array(f["p"])
        n = np.cross(p[1] - p[0], p[2] - p[0])
        n /= np.linalg.norm(n)
        mid = p.mean(0)
        if np.dot(n, mid - np.array([c[0], mid[1] - 2.0, c[2]])) < 0:
            n = -n
        f["n"] = [round(float(v), 4) for v in n]
    a, b, d = corners[0], corners[1], corners[3]
    w, dep = np.linalg.norm(b - a), np.linalg.norm(d - a)
    top = max(max(q[1] for q in f["p"]) for f in faces)
    buildings.append({
        "name": name, "faces": faces, "x": round(float(c[0]), 2), "z": round(float(c[2]), 2),
        "yaw": round(math.atan2(b[2] - a[2], b[0] - a[0]), 4), "w": round(float(w), 2), "d": round(float(dep), 2),
        "top": round(float(top), 2), "dist": round(float(np.hypot(c[0], c[2])), 1),
    })
    print(f"{name:8s} dist {np.hypot(c[0], c[2]):6.1f}  {w:5.1f} x {dep:5.1f} m  top {top - FLOOR:5.1f} m above the floor")


def end_wall(a, a2, at, a2t, apex, uv_a, uv_at, slice_px, low_py, high_py):
    """An end wall he did not paint: the wall beside it carried round the corner, by height."""
    y0, y1 = a[1], max(apex[1], at[1], a2t[1])
    def uv(p, far):
        t = (p[1] - y0) / (y1 - y0)
        return [uv_a[0] + (slice_px if far else 0.0), low_py + (high_py - low_py) * t]
    mid = (a + a2) / 2
    return [
        face("wall", [a, a2, a2t, at], [uv(a, 0), uv(a2, 1), uv(a2t, 1), uv(at, 0)]),
        face("wall", [at, a2t, apex], [uv(at, 0), uv(a2t, 1), [uv_a[0] + slice_px / 2, high_py]]),
    ]


def front(name, xl, xr, base, eave, ridge, depth, low=None, roof=True):
    """A long side toward us: a wall, and above it a roof slope up to the ridge.
    The house is a true upright box with a level ridge over its middle; the
    slant he gave the roof (its top edge set to one side of its bottom edge)
    is met by turning the whole house, not by leaning it."""
    low = min(low or base, LOW)
    el, er = (eave, eave) if np.isscalar(eave) else eave
    m = G((xl + xr) / 2, base)
    mdir = level(m)
    def build(th):
        c0, s0 = math.cos(th), math.sin(th)
        t0 = np.array([-mdir[2], 0.0, mdir[0]])
        if project(m + t0)[0] < project(m)[0]:
            t0 = -t0
        t = np.array([t0[0] * c0 - t0[2] * s0, 0.0, t0[0] * s0 + t0[2] * c0])
        n = np.array([-t[2], 0.0, t[0]])
        if np.dot(n, mdir) < 0:
            n = -n
        h = lift(m, (el + er) / 2)[1]
        ks = np.arange(0.5, 30.0, 0.05)
        ka = min(ks, key=lambda k: abs(project([m[0] - t[0] * k, h, m[2] - t[2] * k])[0] - xl))
        kb = min(ks, key=lambda k: abs(project([m[0] + t[0] * k, h, m[2] + t[2] * k])[0] - xr))
        return m - t * ka, m + t * kb, n, h
    th = 0.0
    if roof:
        want = (ridge[0][0] + ridge[1][0]) / 2
        def miss(th):
            a, b, n, h = build(th)
            c = (a + b) / 2 + n * depth / 2
            return abs(project([c[0], h + 2.5, c[2]])[0] - want)
        th = min(np.radians(np.arange(-12, 12.5, 0.5)), key=miss)
    a, b, n, h = build(th)
    a2, b2 = a + n * depth, b + n * depth
    up = lambda q, y: np.array([q[0], y, q[2]])
    at, bt, a2t, b2t = up(a, h), up(b, h), up(a2, h), up(b2, h)
    ua, ub, uat, ubt = [xl, low], [xr, low], [xl, el], [xr, er]
    s0, s1 = calm(xl, xr, (el + er) / 2 + 1, low)
    em = (el + er) / 2
    faces = [face("wall", [a, b, bt, at], [ua, ub, ubt, uat]), face("wall", [b2, a2, a2t, b2t], [[s1, low], [s0, low], [s0, em], [s1, em]])]
    width = np.linalg.norm(b - a)
    sl = min(1.0, depth / width) * (xr - xl)
    if roof:
        mid = (a + b) / 2 + n * depth / 2
        hr = lift(mid, (ridge[0][1] + ridge[1][1]) / 2)[1]
        hr = min(max(hr, h + 0.3 * depth), h + 0.75 * depth)     # a roof a mason would build
        ra, rb = up(a + n * depth / 2, hr), up(b + n * depth / 2, hr)
        ura, urb = list(ridge[0]), list(ridge[1])
        faces += [face("roof", [at, bt, rb, ra], [uat, ubt, urb, ura]), face("roof", [b2t, a2t, ra, rb], [ubt, uat, ura, urb])]
        faces += end_wall(a, a2, at, a2t, ra, [s0, 0], uat, s1 - s0, low, em + 1)
        faces += end_wall(b, b2, bt, b2t, rb, [s1, 0], ubt, s0 - s1, low, em + 1)
    else:
        faces += [face("wall", [a, a2, a2t, at], [ua, [ua[0] + sl, ua[1]], [uat[0] + sl, uat[1]], uat]),
                  face("wall", [b, b2, b2t, bt], [ub, [ub[0] - sl, ub[1]], [ubt[0] - sl, ubt[1]], ubt])]
    finish(name, faces, [a, b, b2, a2])
    print(f"         turned {math.degrees(th):5.1f} deg")
    return a, b, a2, b2, at, bt, n


def corner(name, xa, xc, xb, base, wg, eaves, apex, ridge_far, low=None, wallsrc=None):
    """A gable end (from xa to the corner at xc) and a long side (from xc to xb) under one roof."""
    low = min(low or base, LOW)
    ea, ec, eb = eaves
    c = G(xc, base)
    ct = lift(c, ec)
    cdir = level(c)
    best = None
    for i in range(1440):   # which way the gable end runs, so that it is wg metres wide and ends at column xa
        th = i * math.pi / 720
        u = np.array([math.cos(th), 0.0, math.sin(th)])
        if np.dot(u, cdir) < -0.05:
            continue
        err = abs(project(lift(c + u * wg, ea))[0] - xa)
        if best is None or err < best[0]:
            best = (err, u)
    u = best[1]
    a = c + u * wg
    v = np.array([-u[2], 0.0, u[0]])
    if (project(c + v)[0] - xc) * (xb - xc) < 0:
        v = -v
    t = min(np.arange(3.0, 26.0, 0.05), key=lambda s: abs(project(lift(c + v * s, eb))[0] - xb))
    b = c + v * t
    d = a + v * t
    h = (lift(a, ea)[1] + ct[1] + lift(b, eb)[1]) / 3            # one level eave all round
    up = lambda q, y: np.array([q[0], y, q[2]])
    ct, at, bt, dt = up(c, h), up(a, h), up(b, h), up(d, h)
    gm = (a + c) / 2
    hr = lift(gm, apex[1])[1]
    hr = min(max(hr, h + 0.3 * wg), h + 0.75 * wg)
    ap = up(gm, hr)                                               # the gable stands upright, its point over its middle
    rf = ap + (b - c)
    uc, ua, ub = [xc, low], [xa, low], [xb, low]
    uct, uat, ubt, uap = [xc, ec], [xa, ea], [xb, eb], list(apex)
    urf = list(ridge_far) if ridge_far else project(rf)
    lw = wallsrc or [uc, ub, ubt, uct]      # the long wall's paint: his own, or (where the frame cuts it off) the gable end's
    s0, s1 = calm(lw[0][0], lw[1][0], max(lw[2][1], lw[3][1]) + 1, lw[0][1])
    wt = (lw[2][1] + lw[3][1]) / 2
    faces = [
        face("wall", [c, a, at, ct], [uc, ua, uat, uct]), face("wall", [ct, at, ap], [uct, uat, uap]),
        face("wall", [c, b, bt, ct], lw),
        face("roof", [ct, bt, rf, ap], [uct, ubt, urf, uap]),
        face("roof", [at, dt, rf, ap], [uct, ubt, urf, uap]),
        face("wall", [a, d, dt, at], [[s0, lw[0][1]], [s1, lw[0][1]], [s1, wt], [s0, wt]]),
    ] + end_wall(b, d, bt, dt, rf, [s0, 0], None, s1 - s0, lw[0][1], wt + 1)
    finish(name, faces, [c, b, d, a])
    print(f"         gable turned {math.degrees(math.acos(min(1, abs(np.dot(u, np.array([-cdir[2], 0, cdir[0]])))))):4.0f} deg from square-on, long side {t:4.1f} m, fit {best[0]:.1f} px")


def gablefront(name, xl, xr, base, eave, apex, depth, roofsrc, low=None):
    """A gable end square to us, its roof running straight back."""
    low = min(low or base, LOW)
    a, b = G(xl, base), G(xr, base)
    n = away(a, b)
    a2, b2 = a + n * depth, b + n * depth
    at, bt = lift(a, eave), lift(b, eave)
    a2t, b2t = a2 + [0, at[1] - a[1], 0], b2 + [0, bt[1] - b[1], 0]
    ap = lift((a + b) / 2, apex[1])
    ap2 = ap + n * depth
    ua, ub, uat, ubt, uap = [xl, low], [xr, low], [xl, eave], [xr, eave], list(apex)
    sl = min(1.0, depth / np.linalg.norm(b - a)) * (xr - xl) / 2
    q = roofsrc   # eave near, ridge near, ridge far, eave far
    faces = [
        face("wall", [a, b, bt, at], [ua, ub, ubt, uat]), face("wall", [at, bt, ap], [uat, ubt, uap]),
        face("wall", [b2, a2, a2t, b2t], [ub, ua, uat, ubt]), face("wall", [b2t, a2t, ap2], [ubt, uat, uap]),
        face("wall", [a, a2, a2t, at], [ua, [ua[0] + sl, ua[1]], [uat[0] + sl, uat[1]], uat]),
        face("wall", [b, b2, b2t, bt], [ub, [ub[0] - sl, ub[1]], [ubt[0] - sl, ubt[1]], ubt]),
        face("roof", [at, ap, ap2, a2t], [q[0], q[1], q[2], q[3]]),
        face("roof", [bt, ap, ap2, b2t], [q[0], q[1], q[2], q[3]]),
    ]
    finish(name, faces, [a, b, b2, a2])
    return a, b, n, ap


def spire(name, base_pts, apex_px):
    c = np.mean(base_pts, 0)
    n = level(c)
    ap = on_plane(*apex_px, c, n)
    f0 = [base_pts[0], base_pts[1], ap]
    u0 = [project(p) for p in f0]
    faces = [face("roof", [base_pts[i], base_pts[(i + 1) % 4], ap], u0 if i % 2 == 0 else [u0[1], u0[0], u0[2]]) for i in range(4)]
    finish(name, faces, base_pts)


# ---------------------------------------------------------------- what he painted
# front row
corner("dark", 722, 745, 792, 1022, 6.0, (926, 926, 926), (738, 899), (800, 898))
front("striped", 780, 880, 1018, 986, ((798, 935), (893, 934)), 7.0)
corner("pale", 1000, 968, 868, 1036, 5.5, (1002, 1000, 1000), (983, 948), (895, 958),
       wallsrc=[[998, 1008], [972, 1008], [972, 976], [998, 976]])
front("low", 657, 725, 945, 921, ((662, 903), (727, 903)), 6.0)
# the church: a small house against its left side, the nave with its gable to us and its roof running
# back to the right, a second gabled body with the tower standing in its front, the spire
front("annex", 634, 652, 884, 852, ((636, 828), (660, 827)), 7.0)
corner("nave", 651, 698, 713, 890, 9.4, (851, 858, 848), (673, 812), (687, 811))
ba, bb, bn, bap = gablefront("body", 703, 757, 891, 850, (731, 827), 12.0, [(699, 858), (673, 812), (687, 811), (713, 848)])
# The tower does not come down in front of that gable: his dark arched opening is in the gable
# wall itself. The belfry sits astride the ridge a little way back, and the spire stands on it.
tq = ba + bn * 2.0
tf = lambda px, py: on_plane(px, py, tq, bn)
t00, t10 = tf(722, 838), tf(741, 838)
ttop = (tf(722, 803)[1] + tf(741, 803)[1]) / 2
upto = lambda q, y: np.array([q[0], y, q[2]])
t01, t11 = upto(t00, ttop), upto(t10, ttop)
tb00, tb10, tb01, tb11 = t00 + bn * 3.6, t10 + bn * 3.6, t01 + bn * 3.6, t11 + bn * 3.6
tuv = [[722, 838], [741, 838], [741, 803], [722, 803]]
finish("tower", [face("wall", [t00, t10, t11, t01], tuv), face("wall", [tb10, tb00, tb01, tb11], tuv),
                 face("wall", [t00, tb00, tb01, t01], tuv), face("wall", [t10, tb10, tb11, t11], tuv)], [t00, t10, tb10, tb00])
# The spire as he painted it is a thin needle leaning left (base 718..740 at row 801, point at
# 721,642). The form stands upright over the belfry; its faces wear that needle of paint.
grow = lambda p_, q_: p_ + (p_ - q_) * 0.1
sb = [grow(t01, tb11), grow(t11, tb01), grow(tb11, t01), grow(tb01, t11)]
sc = np.mean(sb, 0)
sap = lift(sc, 642)
suv = [[718.5, 801], [739.5, 801], [721.5, 643]]
finish("spire", [face("roof", [sb[i], sb[(i + 1) % 4], sap], suv if i % 2 == 0 else [suv[1], suv[0], suv[2]]) for i in range(4)], sb)
# left of the church
front("red", 553, 592, 880, 859, ((565, 841), (600, 837)), 6.0, low=868)
front("lamp", 600, 634, 888, 851, ((600, 838), (634, 838)), 6.0, low=882)
# right of the church, row by row
front("blue", 760, 801, 888, 851, ((757, 823), (797, 823)), 7.0)
corner("green", 858, 892, 930, 890, 6.5, (860, 862, 862), (873, 838), (926, 836))
front("far", 930, 968, 851, 831, ((932, 819), (967, 819)), 6.0)
front("band", 938, 1000, 871, 857, ((940, 846), (1000, 846)), 6.0)
front("long", 955, 1072, 908, 885, ((960, 871), (1070, 872)), 7.0)
front("grey", 1026, 1072, 942, 912, ((1024, 900), (1074, 900)), 6.0)
front("right", 1080, 1152, 946, 921, ((1082, 908), (1150, 908)), 6.0)

out = {"camera": {"F": F, "pitch": PITCH, "W": W, "H": H}, "floor": FLOOR, "buildings": buildings}
(ROOT / "public" / "starry" / "village_forms.json").write_text(json.dumps(out, separators=(",", ":")))

# ---------------------------------------------------------------- a picture to check the reading
Z = 5
X0, Y0, X1, Y1 = 520, 620, 1280, 1014  # check picture
dbg = cv2.resize(img[int(Y0 * K):int(Y1 * K), int(X0 * K):int(X1 * K)], ((X1 - X0) * Z, (Y1 - Y0) * Z), interpolation=cv2.INTER_AREA)
order = sorted(buildings, key=lambda b: -b["dist"])
for b in order:
    for f in b["faces"]:
        p = np.array(f["p"])
        if np.dot(np.array(f["n"]), p.mean(0) - EYE) > 0:
            continue   # looks away from the start
        pts = np.array([[(project(q)[0] - X0) * Z, (project(q)[1] - Y0) * Z] for q in p], np.int32)
        cv2.polylines(dbg, [pts], True, (0, 255, 255) if f["kind"] == "wall" else (80, 200, 255), 2)
cv2.imwrite(str(ROOT / "reference" / "debug_village_forms.jpg"), dbg, [cv2.IMWRITE_JPEG_QUALITY, 85])
