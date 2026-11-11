# Xu Vũ Trụ production art v2

Original artwork generated with the Codex built-in image tool against the approved samples. No in-image text except tile prize numbers.

All sprites are trimmed, transparent WebP (quality 85, lossless alpha). The floor and cabinet are opaque; cabinet quality is 80. Anchors refer to the exported image bounds, with positive y downward.

| File | Pixel size | Anchor |
| --- | --- | --- |
| `tile-t5.webp` | 220x195 | centre |
| `tile-t10.webp` | 220x194 | centre |
| `tile-t20.webp` | 220x194 | centre |
| `tile-t30.webp` | 220x194 | centre |
| `tile-t50.webp` | 220x194 | centre |
| `tile-t100.webp` | 220x193 | centre |
| `tile-c1.webp` | 220x208 | centre |
| `tile-c2.webp` | 220x208 | centre |
| `tile-c4.webp` | 220x208 | centre |
| `tile-c6.webp` | 220x208 | centre |
| `tile-c8.webp` | 220x208 | centre |
| `tile-core.webp` | 220x208 | centre |
| `tile-card.webp` | 220x208 | centre |
| `wheel-hub.webp` | 292x300 | centre |
| `orb-red.webp` | 128x123 | centre |
| `orb-orange.webp` | 128x123 | centre |
| `orb-yellow.webp` | 128x123 | centre |
| `orb-green.webp` | 128x123 | centre |
| `orb-blue.webp` | 128x123 | centre |
| `orb-purple.webp` | 128x123 | centre |
| `coin.webp` | 126x128 | centre |
| `coin-stack2.webp` | 128x119 | centre |
| `coin-stack3.webp` | 112x128 | centre |
| `ticket.webp` | 96x63 | centre |
| `gate.webp` | 360x186 | centre |
| `shoot-idle.webp` | 320x307 | centre |
| `shoot-pressed.webp` | 320x282 | centre |
| `robot-left.webp` | 229x300 | bottom-centre |
| `robot-right.webp` | 265x300 | bottom-centre |
| `pusher.webp` | 900x111 | bottom-centre |
| `shelf-floor.webp` | 256x256 | centre |
| `cabinet-bg.webp` | 1080x1920 | centre |

The gate’s centre U opening is transparent and open upward. Orbs are spherical with matching cream equatorial rings. Pressed button has a lower, darker cap. Floor uses mirrored quadrants for an exact seamless repeat.

Raw source PNGs, exact prompts, extraction script and QA records: `packages/games/art-src/xu-vu-tru/v2-raw/` (git-ignored). Dark/light contact sheets: `packages/games/art-src/xu-vu-tru/v2-contact-{dark,light}.png`.

All exported art was reviewed on light and dark backgrounds.

## In the game

game.ts imports every file here and `makeSprites` (art.ts) decodes each once; until one decodes, a plain shape stands in. The cabinet is drawn in three horizontal slices: only its plain interior band (source rows 1130–1410) is stretched, so the orange lip lands on the shelf's front edge (y 802) and the deck sits under it. The wheel's tiles are baked into one ring image, each in a wedge as wide as its slot's weight. A thin slot crops its tile instead of squashing it. Text and live state (counters, marquee, reels, lamps, lights) are drawn in code in the same palette.
