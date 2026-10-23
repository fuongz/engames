#!/usr/bin/env python3
"""Turn generated pose sheets into game-ready pixel atlases (chongdashu-style normalization).

For each <fighter>-<form>: sheets a and b (10 poses each) →
  key out the magenta background → find each pose as a connected blob (not the nominal grid)
  → scale so the standing pose is TARGET_H true pixels tall → snap to a real pixel grid
  → paste onto a fixed CELL_W x CELL_H canvas, feet on BASE_Y, body centre on ANCHOR_X
  → one 20-frame atlas per fighter-form (10 x 2 cells), lossless webp.
Also: the effects sheet (10 blobs) and the stage background.
"""
import json, os, re, subprocess, sys, tempfile

# Usage: python3 tools/vo-dai-sprites.py   (needs ImageMagick 7 and cwebp)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-src", "vo-dai", "pixel")  # generated sheets (gitignored)
OUT = os.path.join(ROOT, "src", "vo-dai", "img", "px")
TARGET_H = 66          # standing height in true pixels (beast: 74)
CELL_W, CELL_H = 144, 112
ANCHOR_X, BASE_Y = 60, 109
TMP = tempfile.mkdtemp()

def sh(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout

def key(src, dst):
    # Magenta out, alpha made binary (pixel art has no soft edges)
    sh("magick", src, "-alpha", "set", "-fuzz", "28%", "-transparent", "#FF00FF",
       "-channel", "A", "-threshold", "50%", "+channel", dst)

def blobs(png, min_area):
    """Bounding boxes (x, y, w, h, area) of opaque connected blobs."""
    out = sh("magick", png, "-alpha", "extract", "-threshold", "50%",
             "-define", "connected-components:verbose=true",
             "-define", f"connected-components:area-threshold={min_area}",
             "-connected-components", "8", "null:")
    res = []
    for line in out.splitlines():
        m = re.match(r"\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) [\d.]+,[\d.]+ (\d+) (?:srgb|gray)\((\d+)", line)
        if m and int(m.group(6)) > 0:  # white = foreground
            w, h, x, y, a = map(int, m.groups()[:5])
            res.append([x, y, w, h, a])
    return res

def merge(boxes, big):
    """Attach small pieces (headband tails, effects) to the nearest big blob."""
    mains = [b[:] for b in boxes if b[4] >= big]
    for b in boxes:
        if b[4] >= big or not mains: continue
        cx, cy = b[0] + b[2] / 2, b[1] + b[3] / 2
        m = min(mains, key=lambda q: (q[0] + q[2] / 2 - cx) ** 2 + (q[1] + q[3] / 2 - cy) ** 2)
        x0, y0 = min(m[0], b[0]), min(m[1], b[1])
        x1, y1 = max(m[0] + m[2], b[0] + b[2]), max(m[1] + m[3], b[1] + b[3])
        m[:4] = [x0, y0, x1 - x0, y1 - y0]
    return mains

def order(boxes, rows=2):
    """Reading order: split into rows by centre y, then left to right."""
    boxes = sorted(boxes, key=lambda b: b[1] + b[3] / 2)
    if rows == 2 and len(boxes) >= 2:
        ys = [b[1] + b[3] / 2 for b in boxes]
        gaps = [(ys[i + 1] - ys[i], i) for i in range(len(ys) - 1)]
        cut = max(gaps)[1] + 1
        groups = [boxes[:cut], boxes[cut:]]
    else:
        groups = [boxes]
    return [b for g in groups for b in sorted(g, key=lambda b: b[0])]

def foot_center(png, box):
    """x centre of the lowest quarter of the pose (the stance), in the box's own coordinates."""
    x, y, w, h = box[:4]
    strip = max(4, h // 4)
    g = sh("magick", png, "-crop", f"{w}x{strip}+{x}+{y + h - strip}", "+repage", "-trim", "-format", "%w %X", "info:").split()
    try:
        sw, sx = int(g[0]), int(g[1].lstrip("+"))
        return sx + sw / 2
    except Exception:
        return w / 2

def by_grid(boxes, W, H, cols=5, rows=2):
    """Group blobs by the 5x2 cell holding their centre, one merged box per cell.
    Survives poses that drift off their cell and effects made of several pieces."""
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

def frames_of(sheet, expect=10):
    keyed = f"{TMP}/{os.path.basename(sheet)}"
    key(sheet, keyed)
    W, H = map(int, sh("magick", "identify", "-format", "%w %h", keyed).split())
    boxes = blobs(keyed, (W * H) // 6000)
    poses = by_grid(boxes, W, H)
    if len(poses) != expect:
        print(f"  ! {os.path.basename(sheet)}: found {len(poses)} poses, expected {expect}", file=sys.stderr)
    return keyed, poses

def place(keyed, box, scale, dst, anchor_x=ANCHOR_X, base_y=BASE_Y, cell=(CELL_W, CELL_H)):
    x, y, w, h = box[:4]
    fc = foot_center(keyed, box)
    sw, shh = max(1, round(w * scale)), max(1, round(h * scale))
    crop = f"{TMP}/crop.png"
    # Box filter = average each mixel block; then hard alpha and a capped palette keep it pixel art
    sh("magick", keyed, "-crop", f"{w}x{h}+{x}+{y}", "+repage", "-filter", "Box", "-resize", f"{sw}x{shh}!",
       "-channel", "A", "-threshold", "50%", "+channel", "+dither", "-colors", "48", crop)
    ox = round(anchor_x - fc * scale)
    oy = round(base_y - shh)
    sh("magick", "-size", f"{cell[0]}x{cell[1]}", "xc:none", crop, "-geometry", f"+{ox}+{oy}", "-composite", dst)

def atlas(frames, dst, cols):
    # Rows with +append, stacked with -append (montage needs a system font)
    rows = []
    for r in range(0, len(frames), cols):
        row = f"{TMP}/row{r}.png"
        sh("magick", *frames[r:r + cols], "-background", "none", "+append", row)
        rows.append(row)
    sh("magick", *rows, "-background", "none", "-append", f"{TMP}/atlas.png")
    sh("cwebp", "-quiet", "-lossless", "-exact", f"{TMP}/atlas.png", "-o", dst)

def fighter(c, form):
    sheets = [f"{SRC}/{c}-{form}-a.png", f"{SRC}/{c}-{form}-b.png"]
    if not all(os.path.exists(s) for s in sheets): return None
    frames, report = [], {}
    for si, sheet in enumerate(sheets):
        keyed, poses = frames_of(sheet)
        poses = (poses + [poses[-1]] * 10)[:10]
        # Standing reference: idle (a, frame 1) / block (b, frame 7)
        ref = poses[0] if si == 0 else poses[6]
        # Beast form stands taller than the human (as the rig drew it, ~1.13x)
        scale = (TARGET_H if form == "human" else 74) / ref[3]
        report[os.path.basename(sheet)] = {"poses": len(poses), "refHeight": ref[3], "scale": round(scale, 4)}
        for i, b in enumerate(poses):
            f = f"{TMP}/{c}-{form}-{si}-{i}.png"
            place(keyed, b, scale, f)
            frames.append(f)
    atlas(frames, f"{OUT}/{c}-{form}.webp", 10)
    return report

def effects():
    src = f"{SRC}/effects.png"
    if not os.path.exists(src): return None
    keyed, poses = frames_of(src)
    frames = []
    for i, b in enumerate(poses[:10]):
        scale = min(1.0, 88 / max(b[2], b[3]), 0.16)
        f = f"{TMP}/fx-{i}.png"
        place(keyed, b, scale, f, anchor_x=48, base_y=48 + round(b[3] * scale / 2), cell=(96, 96))
        frames.append(f)
    atlas(frames, f"{OUT}/effects.webp", 10)
    return {"effects": len(poses)}

def stage():
    src = f"{SRC}/stage.png"
    if not os.path.exists(src): return None
    # 16:9 crop, then a true 480x270 pixel grid (drawn at 2x)
    sh("magick", src, "-gravity", "center", "-crop", "16:9", "+repage", "-filter", "Box", "-resize", "480x270!", "+dither", "-colors", "64", f"{TMP}/stage.png")
    sh("cwebp", "-quiet", "-lossless", f"{TMP}/stage.png", "-o", f"{OUT}/stage.webp")
    return {"stage": "480x270"}

def single(src):
    """A one-subject image (portrait): keyed copy and the union box of its pieces."""
    keyed = f"{TMP}/{os.path.basename(src)}"
    key(src, keyed)
    W, H = map(int, sh("magick", "identify", "-format", "%w %h", keyed).split())
    boxes = blobs(keyed, (W * H) // 6000)
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes); y1 = max(b[1] + b[3] for b in boxes)
    return keyed, [x0, y0, x1 - x0, y1 - y0, 0]

PORTRAIT = 96

def portraits():
    """Six select-screen busts → one 6-cell atlas (96x96 true pixels each, drawn at 2x)."""
    frames = []
    for c in ["ho", "soi", "gau"]:
        for form in ["human", "beast"]:
            src = f"{SRC}/{c}-{form}-portrait.png"
            if not os.path.exists(src): return None
            keyed, box = single(src)
            scale = (PORTRAIT - 4) / max(box[2], box[3])
            f = f"{TMP}/portrait-{c}-{form}.png"
            # Feet-anchoring does not apply to a bust: centre it, sitting on the bottom edge
            place(keyed, box, scale, f, anchor_x=PORTRAIT // 2, base_y=PORTRAIT, cell=(PORTRAIT, PORTRAIT))
            frames.append(f)
    atlas(frames, f"{OUT}/portraits.webp", 6)
    return {"portraits": len(frames)}

# UI kit: element → width in true pixels (drawn at 2x). Heights follow each element's shape.
UI = [("health", 150), ("meter", 100), ("timer", 34), ("gem", 10), ("gemOff", 10),
      ("punch", 44), ("kick", 44), ("special", 40), ("beast", 40), ("pause", 22)]
UI_CELL = (192, 48)

def ui_kit():
    src = f"{SRC}/ui-kit.png"
    if not os.path.exists(src): return None
    keyed, boxes = frames_of(src)
    frames, rects = [], {}
    for i, ((name, width), b) in enumerate(zip(UI, boxes)):
        scale = width / b[2]
        h = round(b[3] * scale)
        f = f"{TMP}/ui-{i}.png"
        crop = f"{TMP}/ui-crop.png"
        sh("magick", keyed, "-crop", f"{b[2]}x{b[3]}+{b[0]}+{b[1]}", "+repage", "-filter", "Box", "-resize", f"{width}x{h}!",
           "-channel", "A", "-threshold", "50%", "+channel", "+dither", "-colors", "48", crop)
        sh("magick", "-size", f"{UI_CELL[0]}x{UI_CELL[1]}", "xc:none", crop, "-geometry", "+0+0", "-composite", f)
        frames.append(f)
        rects[name] = {"x": i * UI_CELL[0], "y": 0, "w": width, "h": min(h, UI_CELL[1])}
    atlas(frames, f"{OUT}/ui.webp", len(frames))
    json.dump(rects, open(f"{OUT}/ui.json", "w"), indent=1)
    return {"ui": len(frames)}

def keyart():
    """Pixel key art for the portal: snapped to a true pixel grid, shown at 2x."""
    done = {}
    for src, ratio, small, out in [("poster-px.png", "3:4", "300x400", "poster-art.webp"), ("banner-px.png", "2:1", "600x300", "banner-art.webp")]:
        if not os.path.exists(f"{SRC}/{src}"): continue
        sh("magick", f"{SRC}/{src}", "-gravity", "center", "-crop", ratio, "+repage", "-filter", "Box", "-resize", f"{small}!",
           "+dither", "-colors", "96", "-filter", "Point", "-resize", "200%", f"{TMP}/key.png")
        sh("cwebp", "-quiet", "-q", "92", f"{TMP}/key.png", "-o", os.path.join(os.path.dirname(OUT), out))
        done[out] = small
    return done or None

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for c in ["ho", "soi", "gau"]:
        for form in ["human", "beast"]:
            r = fighter(c, form)
            if r: report[f"{c}-{form}"] = r
    for fn in (effects, stage, portraits, ui_kit, keyart):
        r = fn()
        if r: report.update(r)
    print(json.dumps(report, indent=1))
