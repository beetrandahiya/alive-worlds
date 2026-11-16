"""The open ground, painted in its own space.

A map of the valley floor and the knoll seen from straight above, made of
individually placed strokes. Every stroke takes its colour from one point of
his paint:
  - the valley's fields: the level bars of field between the grove rows of The
    Starry Night (paint_field.jpg);
  - ground inside the village: the level bars of blue ground behind the roofs,
    left of the church, in The Starry Night (paint_plot.jpg);
  - the knoll's slopes: the stubble of Wheat Sheaves and Rising Moon
    (paint_stubble.jpg), as the owner chose for the open slopes;
  - the knoll's top: the Starry Night's own night greens again (the field
    paint, a little darker), in shorter strokes that wander more.
Strokes lie along the land: level bars running across the view from the start
on the valley floor, streams across the slope on the knoll (what was seen,
looking at those pictures directly: flat ground is level bars; stubble runs in
bending streams; nothing stands).

Writes public/starry/ground_paint.jpg (the paint) and ground_flow.png (the way
the strokes run at each place: R,G = direction, B = which ground it is).
The ground far from the walker wears this map; near the walker real raised
strokes are laid over it and take their colour and direction from it.
"""
import numpy as np
from PIL import Image, ImageDraw

OUT = 'public/starry/'
X0, Z0, SIZE = -380.0, -420.0, 760.0   # the square of world the map covers (metres)
N = 4096
SS = 2                                  # drawn at twice the size, then reduced
FLOOR = -28.0
rs = np.random.RandomState(7)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def knoll(x, z):  # as in analyse.py
    d = np.hypot(x, z)
    fwd = -z / np.maximum(d, 1e-3)
    slope = 0.07 + 0.29 * smoothstep(-0.2, 0.75, fwd)
    de = d + (np.maximum(-z, 0) - d) * smoothstep(0.35, 0.7, fwd)
    q = np.maximum(de - 4, 0)
    f = np.where(q < 4, q * q / 8, q - 2)
    return -slope * f


def regions(x, z):
    """Share of each ground at a place: field, village plot, stubble, grass."""
    d = np.hypot(x, z)
    floor = FLOOR + 1.2 * np.sin(x * 0.013 + 0.5) * np.sin(z * 0.011 + 1.0)
    k = smoothstep(0.8, 5.0, knoll(x, z) - floor)
    fwd = -z / np.maximum(d, 1e-3)
    grass = k * np.maximum(1 - smoothstep(16, 34, d), smoothstep(0.3, -0.6, fwd))
    stub = k - grass
    e = np.hypot((x - 3) / 96.0, (z + 148) / 64.0)
    vill = (1 - k) * (1 - smoothstep(0.86, 1.14, e))
    field = (1 - k) - vill
    return np.stack([field, vill, stub, grass], -1)


def wander(x, z, s):
    return (np.sin(x / s + 1.7) * np.cos(z / (s * 1.3) + 0.4) + 0.6 * np.sin((x + z) / (s * 0.61) + 2.1) * np.sin((x - z) / (s * 0.83))) / 1.6


def flow(x, z, reg):
    """The direction strokes run at a place (radians, in the x-z plane)."""
    tang = np.arctan2(x, -z)  # level, as the start sees it: across the line of sight
    a_field = tang + 0.3 * wander(x, z, 23.0) + 0.22 * wander(z, x, 6.0)
    a_stub = tang + 0.6 * wander(x, z, 9.0) + 0.5 * wander(z, x, 3.1)
    a_grass = tang + 0.7 * wander(x, z, 6.0) + 0.4 * wander(z, x, 2.7)
    return np.where(reg == 0, a_field, np.where(reg == 1, tang + 0.06 * wander(x, z, 31.0), np.where(reg == 2, a_stub, a_grass)))


def load(name, dim=1.0):
    return np.asarray(Image.open(OUT + name).convert('RGB'), np.float32) * dim


def dull(p):
    # The reproduction of the moonrise picture is far more orange than the canvas, which the
    # Kroller-Muller describes as dull yellow-ochre: well on the way to grey.
    g = p.mean(-1, keepdims=True)
    return p * 0.62 + g * 0.38


PATCH = [load('paint_field.jpg'), load('paint_plot.jpg'), dull(load('paint_stubble.jpg', 0.56)), load('paint_field.jpg', 0.8)]
# patch pixels per metre: across the stroke's run, and along the land's depth
PPM = [(31.0, 9.0), (39.0, 11.0), (55.0, 55.0), (31.0, 9.0)]
LEN = [(1.5, 3.3), (2.4, 5.0), (0.8, 1.7), (0.6, 1.3)]
WID = [(0.26, 0.44), (0.24, 0.4), (0.16, 0.27), (0.16, 0.26)]


def fold(t):
    return 1 - np.abs(1 - np.mod(t, 2))


def paint_at(reg, x, z):
    out = np.zeros((len(x), 3), np.float32)
    d = np.hypot(x, z)
    az = np.arctan2(x, -z)
    for k in range(4):
        m = reg == k
        if not m.any():
            continue
        P = PATCH[k]
        h, w = P.shape[:2]
        if k != 2:   # walked round the start and outward from it, so his level bands stay level
            a = az[m] * 170.0 + 26 * wander(x[m], z[m], 85.0) + 9 * wander(z[m], x[m], 31.0)
            b = d[m] + 14 * wander(z[m], x[m], 70.0) + 5 * wander(x[m], z[m], 27.0)
        else:
            a = x[m] + 30 * wander(z[m], x[m], 60.0) + 8 * wander(x[m], z[m], 19.0)
            b = z[m] + 30 * wander(x[m], z[m], 53.0) + 8 * wander(z[m], x[m], 17.0)
        u = np.minimum(w - 1, (fold(a * PPM[k][0] / w) * w).astype(int))
        v = np.minimum(h - 1, (fold(b * PPM[k][1] / h) * h).astype(int))
        out[m] = P[v, u]
    return out


def main():
    M = N * SS
    px = M / SIZE
    B = 512
    bx, bz = np.meshgrid(X0 + (np.arange(B) + 0.5) / B * SIZE, Z0 + (np.arange(B) + 0.5) / B * SIZE)
    bw = regions(bx.ravel(), bz.ravel())
    means = np.stack([p.reshape(-1, 3).mean(0) for p in PATCH])
    tone = (bw @ means * 0.8).reshape(B, B, 3).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(tone).resize((M, M), Image.BILINEAR)
    dr = ImageDraw.Draw(img)
    count = 1_700_000
    x = X0 + rs.rand(count) * SIZE
    z = Z0 + rs.rand(count) * SIZE
    W = regions(x, z)
    c = np.cumsum(W, -1)
    reg = (rs.rand(count)[:, None] * c[:, -1:] > c).sum(-1).clip(0, 3)
    # smaller strokes need more of them: thin the big-stroke grounds instead
    keep = rs.rand(count) < np.array([1.0, 0.8, 1.0, 1.0])[reg]
    x, z, reg = x[keep], z[keep], reg[keep]
    # extra strokes where they are small (the knoll)
    kx = X0 + rs.rand(2_600_000) * SIZE; kz = Z0 + rs.rand(2_600_000) * SIZE
    kw = regions(kx, kz)
    kr = np.where(rs.rand(len(kx)) * (kw[:, 2] + kw[:, 3] + 1e-6) < kw[:, 2], 2, 3)
    kk = rs.rand(len(kx)) < (kw[:, 2] + kw[:, 3])
    x = np.concatenate([x, kx[kk]]); z = np.concatenate([z, kz[kk]]); reg = np.concatenate([reg, kr[kk]])
    order = rs.permutation(len(x))
    x, z, reg = x[order], z[order], reg[order]
    n = len(x)
    ang = flow(x, z, reg) + rs.uniform(-1, 1, n) * np.array([0.1, 0.05, 0.22, 0.3])[reg]
    L = np.array([LEN[k][0] for k in reg]) + rs.rand(n) * np.array([LEN[k][1] - LEN[k][0] for k in reg])
    Wd = np.array([WID[k][0] for k in reg]) + rs.rand(n) * np.array([WID[k][1] - WID[k][0] for k in reg])
    bend = rs.uniform(-0.09, 0.09, n)
    col = paint_at(reg, x, z)
    tx, tz = np.cos(ang), np.sin(ang)
    streak = paint_at(reg, x + 0.35 * tx - 0.2 * tz, z + 0.35 * tz + 0.2 * tx)
    cx = (x - X0) * px
    cz = (z - Z0) * px
    Lp, Wp = L * px / 2, Wd * px / 2
    us = np.array([-1.0, -0.72, -0.25, 0.3, 0.75, 1.0])
    prof = np.array([0.25, 0.82, 1.0, 0.95, 0.7, 0.2])  # a loaded brush: full, then running out
    for i in range(n):
        ax, az_ = tx[i], tz[i]
        bx, bz = -az_, ax
        off = bend[i] * Lp[i] * (1 - us * us)
        top = [(cx[i] + ax * us[j] * Lp[i] + bx * (off[j] + prof[j] * Wp[i]), cz[i] + az_ * us[j] * Lp[i] + bz * (off[j] + prof[j] * Wp[i])) for j in range(6)]
        bot = [(cx[i] + ax * us[j] * Lp[i] + bx * (off[j] - prof[j] * Wp[i]), cz[i] + az_ * us[j] * Lp[i] + bz * (off[j] - prof[j] * Wp[i])) for j in range(5, -1, -1)]
        c0 = col[i]
        # the ridge of paint along one edge catches the light; the other edge sits in its shade
        dr.polygon(top + bot, fill=tuple(int(v) for v in np.clip(c0 * 0.78, 0, 255)))
        mid = [(cx[i] + ax * us[j] * Lp[i] + bx * (off[j] - 0.45 * prof[j] * Wp[i]), cz[i] + az_ * us[j] * Lp[i] + bz * (off[j] - 0.45 * prof[j] * Wp[i])) for j in range(5, -1, -1)]
        dr.polygon(top + mid, fill=tuple(int(v) for v in c0))
        s0 = [(cx[i] + ax * us[j] * Lp[i] * 0.8 + bx * (off[j] + 0.25 * Wp[i]), cz[i] + az_ * us[j] * Lp[i] * 0.8 + bz * (off[j] + 0.25 * Wp[i])) for j in (1, 4)]
        dr.line(s0, fill=tuple(int(v) for v in streak[i]), width=max(1, int(Wp[i] * 0.45)))
        if i % 400000 == 0:
            print(i, '/', n, flush=True)
    img = img.resize((N, N), Image.LANCZOS)
    img.save(OUT + 'ground_paint.jpg', quality=88)
    # the way strokes run, and which ground it is
    F = 512
    gx, gz = np.meshgrid(X0 + (np.arange(F) + 0.5) / F * SIZE, Z0 + (np.arange(F) + 0.5) / F * SIZE)
    Wg = regions(gx, gz)
    rg = Wg.argmax(-1)
    a = flow(gx, gz, rg)
    small = Wg[..., 2] + Wg[..., 3]   # 0 on the valley floor, 1 on the knoll
    flow_img = np.stack([np.cos(a) * 0.5 + 0.5, np.sin(a) * 0.5 + 0.5, small], -1)
    Image.fromarray((flow_img * 255).astype(np.uint8)).save(OUT + 'ground_flow.png')
    # which ground: village plot, stubble, knoll-top grass (the rest is field)
    Image.fromarray((Wg[..., 1:4].clip(0, 1) * 255).astype(np.uint8)).save(OUT + 'ground_region.png')
    print('strokes', n)


main()
