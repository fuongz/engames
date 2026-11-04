#!/usr/bin/env python3
"""Turn Nối Thú's generated tile sheets into one game-ready atlas.

Each sheet (art-src/noi-thu/sheet-{a,b,c}.png) is 12 pink tiles, 6 x 2, on white:
  find each tile as a connected non-white blob (not a nominal grid, so margins and
  spacing may drift) → crop it to its own box → resize every tile to CELL_W x CELL_H
  → pack all 36 in sheet order into a 6 x 6 atlas → lossy webp (the tiles draw at
  ~56 px, so 96 px cells are plenty).
Also: the poster and banner key art, cropped to 3:4 and 2:1.

Usage: python3 tools/noi-thu-sprites.py   (needs ImageMagick 7 and cwebp)
Regenerate the sources with art-src/noi-thu/gen-all.sh (Codex image generation);
the kind order in the atlas is the order of the KINDS table in src/noi-thu/art.ts.
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-src", "noi-thu")  # generated sheets (gitignored)
OUT = os.path.join(ROOT, "src", "noi-thu", "img")
SHEETS = ["sheet-a", "sheet-b", "sheet-c"]
CELL_W, CELL_H = 96, 104
COLS = 6
TMP = tempfile.mkdtemp()


def sh(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def blobs(png, min_area):
    """Bounding boxes (x, y, w, h, area) of the non-white connected blobs."""
    out = sh("magick", png, "-alpha", "set", "-fuzz", "8%", "-transparent", "white",
             "-alpha", "extract", "-threshold", "50%",
             "-define", "connected-components:verbose=true",
             "-define", f"connected-components:area-threshold={min_area}",
             "-connected-components", "8", "null:")
    res = []
    for line in out.splitlines():
        m = re.match(r"\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) [\d.]+,[\d.]+ (\d+) (?:srgb|gray)\((\d+)", line)
        if m and int(m.group(6)) > 0:  # white = tile
            w, h, x, y, a = map(int, m.groups()[:5])
            res.append([x, y, w, h, a])
    return res


def reading_order(boxes):
    """Two rows split by centre y, each left to right."""
    boxes = sorted(boxes, key=lambda b: b[1] + b[3] / 2)
    ys = [b[1] + b[3] / 2 for b in boxes]
    cut = max((ys[i + 1] - ys[i], i) for i in range(len(ys) - 1))[1] + 1
    return [b for g in (boxes[:cut], boxes[cut:]) for b in sorted(g, key=lambda b: b[0])]


def tiles_of(name):
    src = f"{SRC}/{name}.png"
    if not os.path.exists(src):
        sys.exit(f"missing {src}")
    W, H = map(int, sh("magick", "identify", "-format", "%w %h", src).split())
    # A tile is ~1/60 of the sheet; anything far smaller is a stray speck
    boxes = [b for b in blobs(src, (W * H) // 400) if b[2] > W / 12 and b[3] > H / 6]
    if len(boxes) != 12:
        sys.exit(f"{name}: found {len(boxes)} tiles, expected 12")
    return src, reading_order(boxes)


def main():
    os.makedirs(OUT, exist_ok=True)
    frames, report = [], {}
    for name in SHEETS:
        src, boxes = tiles_of(name)
        report[name] = [f"{b[2]}x{b[3]}" for b in boxes]
        for i, (x, y, w, h, _) in enumerate(boxes):
            f = f"{TMP}/{name}-{i:02}.png"
            # Lanczos down to the cell: the sources are soft "mixel" art, not a true pixel grid
            # The tile's cut corners show the white sheet: flood them out from each corner
            corners = [a for cx, cy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))
                       for a in ("-draw", f"color {cx},{cy} floodfill")]
            sh("magick", src, "-crop", f"{w}x{h}+{x}+{y}", "+repage", "-alpha", "set",
               "-fuzz", "12%", "-fill", "none", *corners,
               "-filter", "Lanczos", "-resize", f"{CELL_W}x{CELL_H}!", f)
            frames.append(f)
    rows = []
    for r in range(0, len(frames), COLS):
        row = f"{TMP}/row{r}.png"
        sh("magick", *frames[r:r + COLS], "-background", "none", "+append", row)
        rows.append(row)
    sh("magick", *rows, "-background", "none", "-append", f"{TMP}/atlas.png")
    sh("cwebp", "-quiet", "-q", "88", "-alpha_q", "100", f"{TMP}/atlas.png", "-o", f"{OUT}/tiles.webp")
    report["atlas"] = f"{COLS * CELL_W}x{len(rows) * CELL_H}, {len(frames)} tiles"

    for src, ratio, size, out in [("poster.png", "3:4", "600x800", "poster-art.webp"),
                                  ("banner.png", "2:1", "1200x600", "banner-art.webp")]:
        if not os.path.exists(f"{SRC}/{src}"):
            continue
        sh("magick", f"{SRC}/{src}", "-gravity", "center", "-crop", ratio, "+repage",
           "-filter", "Lanczos", "-resize", f"{size}!", f"{TMP}/key.png")
        sh("cwebp", "-quiet", "-q", "86", f"{TMP}/key.png", "-o", f"{OUT}/{out}")
        report[out] = size
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
