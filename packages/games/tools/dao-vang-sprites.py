#!/usr/bin/env python3
"""Turn Đào Vàng's generated art into the game's shipped .webp files.

Sources (git-ignored) live in art-src/dao-vang/, made by tools/dao-vang-art.sh
with the Codex CLI on a flat magenta background:
  miner.png      3 frames side by side (idle, crank up, crank down)
  claw.png       2 frames (open, closed)
  treasures.png  4x2 grid: gold S/M/L, diamond / rock S/L, sack, coin
  critters.png   4x2 grid: mole walk 1/2, mole + diamond, dynamite / potion, clover, polish, book
  bg.png, shop.png, poster.png, banner.png   full-bleed pictures

Each sheet: key the magenta out → find the objects as connected blobs → group
them by grid cell → scale each to fit a fixed cell → one horizontal atlas.
Usage: python3 tools/dao-vang-sprites.py   (needs ImageMagick 7 and cwebp)
"""
import os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-src", "dao-vang")
OUT = os.path.join(ROOT, "src", "dao-vang", "img")
TMP = tempfile.mkdtemp()

# Cell sizes are 2x the largest size the game draws them at (logical px)
MINER_CELL = (300, 260)   # drawn ≈150x130
CLAW_CELL = (128, 128)    # drawn ≈64x64
ITEM_CELL = 200           # drawn up to ≈110 (large gold)


def sh(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def key(src, dst):
    """Magenta out; shave the 1px pink fringe the antialiasing leaves on outlines."""
    sh("magick", src, "-alpha", "set", "-fuzz", "30%", "-transparent", "#FF00FF",
       "-channel", "A", "-morphology", "Erode", "Disk:1", "+channel", dst)


def blobs(png, min_area):
    out = sh("magick", png, "-alpha", "extract", "-threshold", "50%",
             "-define", "connected-components:verbose=true",
             "-define", f"connected-components:area-threshold={min_area}",
             "-connected-components", "8", "null:")
    res = []
    for line in out.splitlines():
        m = re.match(r"\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) [\d.]+,[\d.]+ (\d+) (?:srgb|gray)\((\d+)", line)
        if m and int(m.group(6)) > 0:
            w, h, x, y, a = map(int, m.groups()[:5])
            res.append([x, y, w, h, a])
    return res


def by_grid(boxes, W, H, cols, rows):
    """One merged box per grid cell (sparkles and fuses join their object)."""
    cells = {}
    for b in boxes:
        cx, cy = b[0] + b[2] / 2, b[1] + b[3] / 2
        k = (min(rows - 1, int(cy / (H / rows))), min(cols - 1, int(cx / (W / cols))))
        if k in cells:
            m = cells[k]
            x0, y0 = min(m[0], b[0]), min(m[1], b[1])
            x1, y1 = max(m[0] + m[2], b[0] + b[2]), max(m[1] + m[3], b[1] + b[3])
            cells[k] = [x0, y0, x1 - x0, y1 - y0, m[4] + b[4]]
        else:
            cells[k] = b[:]
    return [cells[k] for k in sorted(cells)]


def sheet(name, cols, rows):
    keyed = f"{TMP}/{name}.png"
    key(os.path.join(SRC, f"{name}.png"), keyed)
    W, H = map(int, sh("magick", "identify", "-format", "%w %h", keyed).split())
    boxes = by_grid(blobs(keyed, 60), W, H, cols, rows)
    if len(boxes) != cols * rows:
        sys.exit(f"{name}.png: found {len(boxes)} objects, expected {cols * rows}")
    return keyed, boxes


def fit(keyed, box, cell, dst, align="center", scale=None):
    """Crop a box and paste it into a cell; returns the scale used."""
    x, y, w, h = box[:4]
    cw, ch = cell
    s = scale or min((cw - 4) / w, (ch - 4) / h)
    sw, shh = max(1, round(w * s)), max(1, round(h * s))
    crop = f"{TMP}/crop.png"
    sh("magick", keyed, "-crop", f"{w}x{h}+{x}+{y}", "+repage", "-filter", "Lanczos",
       "-resize", f"{sw}x{shh}!", crop)
    if align == "bottom-right":
        ox, oy = cw - 2 - sw, ch - 2 - shh
    elif align == "top":
        ox, oy = (cw - sw) // 2, 2
    else:
        ox, oy = (cw - sw) // 2, (ch - shh) // 2
    sh("magick", "-size", f"{cw}x{ch}", "xc:none", crop, "-geometry", f"+{ox}+{oy}", "-composite", dst)
    return s


def atlas(frames, dst, q=88):
    sh("magick", *frames, "+append", f"{TMP}/atlas.png")
    sh("cwebp", "-quiet", "-q", str(q), "-alpha_q", "100", f"{TMP}/atlas.png", "-o", dst)
    print("wrote", os.path.relpath(dst, ROOT))


def miner():
    keyed, boxes = sheet("miner", 3, 1)
    # Same scale for every frame, so the winch does not jump between them
    s = min(min((MINER_CELL[0] - 4) / b[2], (MINER_CELL[1] - 4) / b[3]) for b in boxes)
    frames = []
    for i, b in enumerate(boxes):
        f = f"{TMP}/miner{i}.png"
        fit(keyed, b, MINER_CELL, f, "bottom-right", s)
        frames.append(f)
    atlas(frames, f"{OUT}/miner.webp")


def claw():
    keyed, boxes = sheet("claw", 2, 1)
    s = min(min((CLAW_CELL[0] - 4) / b[2], (CLAW_CELL[1] - 4) / b[3]) for b in boxes)
    frames = []
    for i, b in enumerate(boxes):
        f = f"{TMP}/claw{i}.png"
        fit(keyed, b, CLAW_CELL, f, "top", s)
        frames.append(f)
    atlas(frames, f"{OUT}/claw.webp")


def items():
    frames = []
    for name in ("treasures", "critters"):
        keyed, boxes = sheet(name, 4, 2)
        # The two walking moles share a scale so the cycle does not pulse
        shared = None
        for i, b in enumerate(boxes):
            f = f"{TMP}/{name}{i}.png"
            if name == "critters" and i < 3:
                shared = shared or min((ITEM_CELL - 4) / b[2], (ITEM_CELL - 4) / b[3])
                fit(keyed, b, (ITEM_CELL, ITEM_CELL), f, "center", shared)
            else:
                fit(keyed, b, (ITEM_CELL, ITEM_CELL), f)
            frames.append(f)
    atlas(frames, f"{OUT}/items.webp")


def picture(name, size, dst, q):
    sh("magick", os.path.join(SRC, f"{name}.png"), "-resize", f"{size}^", "-gravity", "center",
       "-extent", size, f"{TMP}/{name}-p.png")
    sh("cwebp", "-quiet", "-q", str(q), f"{TMP}/{name}-p.png", "-o", dst)
    print("wrote", os.path.relpath(dst, ROOT))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    miner()
    claw()
    items()
    picture("bg", "720x1280", f"{OUT}/bg.webp", 82)
    picture("shop", "720x1280", f"{OUT}/shop.webp", 80)
    picture("poster", "600x800", f"{OUT}/poster-art.webp", 88)
    picture("banner", "1200x600", f"{OUT}/banner-art.webp", 86)
