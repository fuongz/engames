import { type App, W, close, shade, sheet } from "./app";
import { C, panel, sprite, text } from "./art";
import { RECORDS, type MusicRecord } from "./config";
import { drawHub } from "./hub";
import { dialogButtons, dialogPage } from "./kit";
import { playRecord } from "./logic";
import { hasTrack } from "./music";

// The music box on the counter: the record turning on it, the records the
// baker owns (tap one to put it on), a way to stop, and to buy more.

/** Records that can be offered here: their track was bundled. */
export const playable = (r: MusicRecord) => hasTrack(r.id);

export function drawMusicBox(app: App) {
  const { ctx, save } = app;
  const tr = app.tr();
  drawHub(app);
  app.held = true;
  const back = () => app.go({ kind: "hub" });
  shade(app, back);
  const owned = RECORDS.filter(
    (r) => save.records.includes(r.id) && playable(r),
  );
  const cols = 3;
  const rows = Math.max(1, Math.ceil(owned.length / cols));
  const h = 44 + 150 + rows * 128 + 24 + 64 * 2 + 16 + 40;
  const m = { x: 24, y: Math.max(70, (960 - h) / 2), w: W - 48, h };
  const paper = sheet(app, m, tr.musicBox.title);
  close(app, { ...m, w: m.w - 16, y: m.y + 4 }, back);

  // The record on the box, turning
  const now = RECORDS.find((r) => r.id === save.playing);
  const cx = paper.x + 80;
  const cy = paper.y + 72;
  ctx.save();
  ctx.translate(cx, cy);
  if (now) ctx.rotate(app.time * 1.6);
  sprite(ctx, app.sprites.get("vinyl"), 0, 0, 118, 118);
  ctx.restore();
  if (!app.sprites.get("vinyl")?.naturalWidth) {
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fillStyle = "#2b2220";
    ctx.fill();
  }
  text(
    ctx,
    now ? tr.musicBox.playing : tr.musicBox.off,
    paper.x + 160,
    cy - 18,
    {
      size: 15,
      align: "left",
      fill: C.muted,
    },
  );
  text(ctx, now ? now.title : "…", paper.x + 160, cy + 12, {
    size: 21,
    align: "left",
    maxWidth: dialogPage(m.w) - 170,
  });

  // The records owned, three to a row
  const gw = paper.w / cols;
  owned.forEach((r, i) => {
    const gx = paper.x + gw * (i % cols);
    const gy = paper.y + 150 + Math.floor(i / cols) * 128;
    const on = save.playing === r.id;
    const key = `rec-${r.id}`;
    const sink = app.ui.isPressed(key) ? 3 : 0;
    panel(
      ctx,
      { x: gx + 6, y: gy + sink, w: gw - 12, h: 120 },
      { fill: on ? "#eaf7e1" : C.white, radius: 16, line: on ? 3 : 2 },
    );
    sprite(
      ctx,
      app.sprites.get(r.sprite),
      gx + gw / 2,
      gy + 48 + sink,
      gw - 36,
      78,
    );
    text(ctx, r.title, gx + gw / 2, gy + 104 + sink, {
      size: 12,
      maxWidth: gw - 20,
      fill: on ? C.good : C.text,
    });
    app.ui.add({
      rect: { x: gx + 6, y: gy, w: gw - 12, h: 120 },
      key,
      tap: () => {
        app.sfx.tap();
        app.commit(playRecord(save, r.id));
      },
    });
  });

  dialogButtons(app, { ...m, h: m.h - 80 }, [
    {
      key: "music-off",
      label: tr.musicBox.off,
      disabled: !save.playing,
      onTap: () => app.commit(playRecord(save, null)),
    },
  ]);
  dialogButtons(app, m, [
    {
      key: "music-shop",
      label: tr.musicBox.buyMore,
      fill: "#fff0bf",
      size: 18,
      onTap: () => app.go({ kind: "market", cart: {}, aisle: 4 }),
    },
  ]);
}
