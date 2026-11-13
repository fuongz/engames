# Xếp Tầng — notes

**Genre:** one-tap block stacking, popularised by Ketchapp's *Stack* (2016). We take only the
genre mechanic; the name, palette, sky, sounds, UI and wording are our own.

## Rules we use

| Rule | Choice |
| --- | --- |
| Slabs | start 1 × 1 on a pedestal; each new slab has the size of the one below |
| Motion | slides along x, then z, alternating; enters from a random end (seeded) and bounces between ±1.25 |
| Drop | one tap / Space; the overhang is sliced off and tumbles away |
| Miss | no overlap (or < 0.004) ends the run; the whole slab falls |
| Perfect | centre within 0.035 of the slab below snaps exactly; chime rises a pentatonic step per perfect in a row |
| Grow back | from the 3rd perfect in a row, each perfect adds 0.06 along its axis, never past the first slab's size |
| Speed | 1.5 units/s, +0.02 per floor, capped at 3 (≈ floor 75) |
| Score | slabs placed; leaderboard detail "12 tầng · 5 hoàn hảo" |

`logic.ts` is pure and deterministic for a seed; the game runs on `fixedStep: 1/60` so the
slide speed is the same on 60 Hz and 120 Hz screens.

## Look

"Khối màu tối giản": square Three.js blocks, the hue turning 5° a floor. The
original fixed isometric camera and colours are preserved, with Lambert lighting. No rounded geometry, glossy materials, tone mapping or
end-of-run orbit. Each block is 12 triangles instead of the rounded mesh's 300.

Subtle contact shadows are transparent 12%-opacity rectangles, shifted in the
light's direction and clipped to the supporting slab. All patches share one
instanced draw call. They are a deliberate approximation, without a shadow map,
extra shadow render pass, blur or physically simulated falling-piece shadows.

The core's single render loop composites the transparent WebGL canvas over the
2D sky before painting the HUD. Geometry/materials are reused, tower blocks are
instanced, resolution is capped at 1.5× CSS pixels, and GPU resources are disposed
on exit. Canvas 2D remains the fallback when WebGL creation fails or its context
is lost. The canvas copy remains a per-frame cost; phone performance is still
subject to manual validation, not an asserted frame-rate improvement.

The sky moves from dawn to day, sunset and starry night. Landing retains the
original squash and screen thump; a perfect adds a ripple and sparks. The camera
only pulls back at game over. Reduced motion disables 3D fragment rotation.

## Art

Key art from Codex (minimal isometric tower at dusk, no text); raw PNGs in the git-ignored
`art-src/xep-tang/`. `cover.ts` bakes the localized title onto the poster. In-game text is
**Baloo 2** 600/800 (full Vietnamese, imported in `game.ts`).
