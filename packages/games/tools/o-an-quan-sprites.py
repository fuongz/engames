#!/usr/bin/env python3
"""Turn Ô Ăn Quan's generated art into game-ready webp files.

Sources (art-src/o-an-quan/, gitignored, made with Codex image generation; the
prompts sit next to them as *.txt):
  stones-{a,b,c}.png  8 stones on flat magenta: 6 pebbles + 2 big quan stones
  bg-{a,b,c}.png      the portrait backdrop of each theme
  sample-a-san-gach.png, banner-raw.png   key art for the poster and banner

Each stone sheet → find the 8 blobs (connected components after keying out the
magenta) → the two largest are the quan stones → pack an atlas of PEBBLE px
pebbles then QUAN px quans in one row (the layout `STONE_ATLAS` in art.ts reads).

Usage: python3 tools/o-an-quan-sprites.py   (needs ImageMagick 7 and cwebp)
"""
import os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-src", "o-an-quan")
OUT = os.path.join(ROOT, "src", "o-an-quan", "img")
THEMES = {"a": "san-gach", "b": "son-mai", "c": "dong-ho"}
PEBBLE, QUAN = 72, 144
TMP = tempfile.mkdtemp()


def sh(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def keyed(src):
    """The sheet with the magenta keyed out and the fringe pulled in by a pixel."""
    out = f"{TMP}/{os.path.basename(src)}"
    sh("magick", src, "-alpha", "set", "-fuzz", "30%", "-transparent", "#ff00ff",
       "(", "+clone", "-alpha", "extract", "-morphology", "Erode", "Disk:1.5", "-blur", "0x0.7", ")",
       "-compose", "CopyOpacity", "-composite", out)
    return out


def blobs(png):
    out = sh("magick", png, "-alpha", "extract", "-threshold", "50%",
             "-define", "connected-components:verbose=true",
             "-define", "connected-components:area-threshold=400",
             "-connected-components", "8", "null:")
    res = []
    for line in out.splitlines():
        m = re.match(r"\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) [\d.]+,[\d.]+ (\d+) (?:srgb|gray)\((\d+)", line)
        if m and int(m.group(6)) > 0:
            w, h, x, y, a = map(int, m.groups()[:5])
            res.append((x, y, w, h, a))
    return res


def cell(src, box, size, out):
    x, y, w, h, _ = box
    pad = 2
    sh("magick", src, "-crop", f"{w + 2 * pad}x{h + 2 * pad}+{max(0, x - pad)}+{max(0, y - pad)}", "+repage",
       "-filter", "Lanczos", "-resize", f"{size - 4}x{size - 4}", "-background", "none",
       "-gravity", "center", "-extent", f"{size}x{size}", out)


def stones(letter, theme):
    src = f"{SRC}/stones-{letter}.png"
    if not os.path.exists(src):
        sys.exit(f"missing {src}")
    k = keyed(src)
    found = sorted(blobs(k), key=lambda b: -b[4])
    if len(found) != 8:
        sys.exit(f"stones-{letter}: found {len(found)} stones, expected 8")
    quans, pebbles = found[:2], sorted(found[2:], key=lambda b: (b[1] // 200, b[0]))
    parts = []
    for i, b in enumerate(pebbles):
        f = f"{TMP}/{letter}-p{i}.png"
        cell(k, b, PEBBLE, f)
        parts.append(f)
    row = f"{TMP}/{letter}-pebbles.png"
    sh("magick", *parts, "-background", "none", "+append", row)
    qs = []
    for i, b in enumerate(quans):
        f = f"{TMP}/{letter}-q{i}.png"
        cell(k, b, QUAN, f)
        qs.append(f)
    # Pebbles along the top of the first 6×PEBBLE, quans after them
    atlas = f"{TMP}/{letter}-atlas.png"
    sh("magick", "-size", f"{6 * PEBBLE + 2 * QUAN}x{QUAN}", "xc:none",
       row, "-geometry", "+0+0", "-composite",
       qs[0], "-geometry", f"+{6 * PEBBLE}+0", "-composite",
       qs[1], "-geometry", f"+{6 * PEBBLE + QUAN}+0", "-composite", atlas)
    webp(atlas, f"{OUT}/stones-{theme}.webp", 88, alpha=True)


def webp(src, dst, q, alpha=False):
    args = ["cwebp", "-quiet", "-q", str(q)]
    if alpha:
        args += ["-alpha_q", "100", "-exact"]
    sh(*args, src, "-o", dst)
    print("wrote", dst.replace(ROOT + "/", ""), os.path.getsize(dst) // 1024, "KB")


def fitted(src, w, h, out):
    sh("magick", src, "-resize", f"{w}x{h}^", "-gravity", "center", "-extent", f"{w}x{h}", out)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for letter, theme in THEMES.items():
        stones(letter, theme)
        webp(fitted(f"{SRC}/bg-{letter}.png", 720, 1280, f"{TMP}/bg-{letter}.png"), f"{OUT}/bg-{theme}.webp", 74)
    webp(fitted(f"{SRC}/sample-a-san-gach.png", 600, 800, f"{TMP}/poster.png"), f"{OUT}/poster-art.webp", 82)
    webp(fitted(f"{SRC}/banner-raw.png", 1200, 600, f"{TMP}/banner.png"), f"{OUT}/banner-art.webp", 80)


main()
