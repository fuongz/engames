#!/usr/bin/env python3
"""Turn Mèo Vũ Trụ's generated art into the game's shipped .webp files.

Sources (git-ignored), all on a flat magenta background:
  art-src/samples/meo/sheet.png  the approved 4x3 sheet: ship, grunt, jet cat, gunner /
                                 saucer cat, robo-kitten, dried fish, fish bone /
                                 (three old gift boxes, unused), power orb
  art-src/samples/meo/boss.png   the approved chapter-1 boss
  art-src/meo-vu-tru/ufos.png    4 bubble-UFO cats in a row (tools/meo-vu-tru-art.sh)
  art-src/meo-vu-tru/pickups.png red / blue / green fish cans, missile, heart
  art-src/meo-vu-tru/boss2.png, boss3.png
  art-src/meo-vu-tru/bg.png, poster.png, banner.png   full-bleed pictures

Each sheet: key the magenta out -> find the objects as connected blobs -> group
them by grid cell -> scale each to fit a fixed cell -> one horizontal atlas.
Usage: python3 tools/meo-vu-tru-sprites.py   (needs ImageMagick 7 and cwebp)
"""
import os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-src", "meo-vu-tru")
SAMPLES = os.path.join(ROOT, "art-src", "samples", "meo")
OUT = os.path.join(ROOT, "src", "meo-vu-tru", "img")
TMP = tempfile.mkdtemp()

# 2x the largest size the game draws a sprite (ship ≈ 84 px); bosses at 1.5x (≈ 290 px)
CELL = 160
BOSS_CELL = 420


def sh(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def key(src, dst):
    """Magenta out; shave the 1px pink fringe the antialiasing leaves on outlines.
    The fuzz is kept tight so purple and pink artwork (UFOs, the queen) survives."""
    sh("magick", src, "-alpha", "set", "-fuzz", "22%", "-transparent", "#FF00FF",
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
    """One merged box per grid cell (flames, sparkles and propellers join their object)."""
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


def sheet(path, cols, rows):
    name = os.path.splitext(os.path.basename(path))[0]
    keyed = f"{TMP}/{name}.png"
    key(path, keyed)
    W, H = map(int, sh("magick", "identify", "-format", "%w %h", keyed).split())
    boxes = by_grid(blobs(keyed, 400), W, H, cols, rows)
    if len(boxes) != cols * rows:
        sys.exit(f"{path}: found {len(boxes)} objects, expected {cols * rows}")
    return keyed, boxes


def fit(keyed, box, cell, dst, scale=None):
    """Crop a box and centre it in a square cell; returns the scale used."""
    x, y, w, h = box[:4]
    s = scale or min((cell - 4) / w, (cell - 4) / h)
    sw, shh = max(1, round(w * s)), max(1, round(h * s))
    crop = f"{TMP}/crop.png"
    sh("magick", keyed, "-crop", f"{w}x{h}+{x}+{y}", "+repage", "-filter", "Lanczos",
       "-resize", f"{sw}x{shh}!", crop)
    ox, oy = (cell - sw) // 2, (cell - shh) // 2
    sh("magick", "-size", f"{cell}x{cell}", "xc:none", crop, "-geometry", f"+{ox}+{oy}", "-composite", dst)
    return s


def atlas(frames, dst, q=86):
    sh("magick", *frames, "+append", f"{TMP}/atlas.png")
    sh("cwebp", "-quiet", "-q", str(q), "-alpha_q", "100", f"{TMP}/atlas.png", "-o", dst)
    print("wrote", os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, "KB")


def sprites():
    """sprites.webp, 160 px cells in this order (art.ts SPRITE):
    0 ship, 1 grunt, 2 jet, 3 gunner, 4 saucer, 5 kitten, 6 fish, 7 bone, 8 orb,
    9-12 ufo teal/purple/orange/pink, 13-15 can red/blue/green, 16 missile, 17 heart."""
    frames = []
    keyed, boxes = sheet(os.path.join(SAMPLES, "sheet.png"), 4, 3)
    for i in (0, 1, 2, 3, 4, 5, 6, 7, 11):
        f = f"{TMP}/s{len(frames)}.png"
        fit(keyed, boxes[i], CELL, f)
        frames.append(f)
    keyed, boxes = sheet(os.path.join(SRC, "ufos.png"), 4, 1)
    # One scale for the four UFOs so the formation reads as one family
    s = min(min((CELL - 4) / b[2], (CELL - 4) / b[3]) for b in boxes)
    for b in boxes:
        f = f"{TMP}/s{len(frames)}.png"
        fit(keyed, b, CELL, f, s)
        frames.append(f)
    keyed, boxes = sheet(os.path.join(SRC, "pickups.png"), 5, 1)
    for b in boxes:
        f = f"{TMP}/s{len(frames)}.png"
        fit(keyed, b, CELL, f)
        frames.append(f)
    atlas(frames, f"{OUT}/sprites.webp")


def bosses():
    """bosses.webp: chapter 1, 2, 3 bosses, 420 px cells."""
    frames = []
    for i, path in enumerate((os.path.join(SAMPLES, "boss.png"), os.path.join(SRC, "boss2.png"),
                              os.path.join(SRC, "boss3.png"))):
        keyed, boxes = sheet(path, 1, 1)
        f = f"{TMP}/b{i}.png"
        fit(keyed, boxes[0], BOSS_CELL, f)
        frames.append(f)
    atlas(frames, f"{OUT}/bosses.webp", 84)


def picture(name, size, dst, q):
    sh("magick", os.path.join(SRC, f"{name}.png"), "-resize", f"{size}^", "-gravity", "center",
       "-extent", size, f"{TMP}/{name}-p.png")
    sh("cwebp", "-quiet", "-q", str(q), f"{TMP}/{name}-p.png", "-o", dst)
    print("wrote", os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, "KB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    sprites()
    bosses()
    picture("bg", "540x960", f"{OUT}/bg.webp", 80)
    picture("poster", "600x800", f"{OUT}/poster-art.webp", 86)
    picture("banner", "1200x600", f"{OUT}/banner-art.webp", 84)
