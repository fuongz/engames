import { type App, W, btn, close, shade, sheet, viewRect } from "./app";
import { C, card, cover, sprite, text, wrap } from "./art";
import { drawHub } from "./hub";
import { dialogButtons, dialogHeight, dialogPage } from "./kit";

// The account's bakeries (save slots) and the settings dialog: switch bakery,
// sound and music, and starting a bakery over (asked twice).

export function drawSlots(app: App, list: App["screen"] & { kind: "slots" }) {
  const { ctx } = app;
  const tr = app.tr();
  const v = viewRect(app);
  cover(ctx, app.sprites.get("bg-kitchen"), v, 0.45);
  ctx.fillStyle = C.shade;
  ctx.fillRect(v.x, v.y, v.w, v.h);

  const board = { x: 24, y: Math.max(v.y + 40, 150), w: W - 48, h: 640 };
  const paper = sheet(app, board, tr.slotsTitle);
  if (!list.list) {
    const bob = Math.sin(app.time * 4) * 6;
    sprite(
      ctx,
      app.sprites.get("cake-cupcake"),
      W / 2,
      paper.y + paper.h / 2 - 30 + bob,
      110,
      110,
    );
    text(ctx, tr.loading, W / 2, paper.y + paper.h / 2 + 50, { size: 22 });
    return;
  }
  const gap = 14;
  const h = (paper.h - 24 - gap * 2) / 3;
  list.list.forEach(({ slot, save }, i) => {
    const r = {
      x: paper.x + 10,
      y: paper.y + 12 + i * (h + gap),
      w: paper.w - 20,
      h,
    };
    const key = `slot-${slot}`;
    const pressed = app.ui.isPressed(key);
    const tile = card(ctx, r, save ? "pink" : "green", pressed, h - 20);
    const pic = { x: tile.x, y: tile.y, w: 120, h: tile.h };
    sprite(
      ctx,
      app.sprites.get(save ? "cake-cupcake" : "cake-box"),
      pic.x + pic.w / 2,
      pic.y + pic.h / 2,
      pic.w - 16,
      pic.h - 16,
    );
    const tx = pic.x + pic.w + 14;
    const maxWidth = tile.x + tile.w - tx - 10;
    const mid = tile.y + tile.h / 2;
    // The bakery played last stands out
    const playing = slot === app.slot;
    text(ctx, tr.slotName(slot + 1), tx, mid - 30, {
      size: 24,
      weight: 800,
      align: "left",
      maxWidth,
      fill: playing ? C.good : C.text,
    });
    if (save) {
      text(ctx, tr.slotInfo(save.day, save.coins), tx, mid + 4, {
        size: 18,
        align: "left",
        maxWidth,
      });
      text(ctx, tr.slotRep(save.rep), tx, mid + 32, {
        size: 16,
        align: "left",
        fill: C.muted,
        maxWidth,
      });
    } else {
      text(ctx, tr.slotEmpty, tx, mid + 4, {
        size: 18,
        align: "left",
        maxWidth,
      });
      text(ctx, tr.slotNew, tx, mid + 32, {
        size: 16,
        align: "left",
        fill: C.muted,
        maxWidth,
      });
    }
    app.ui.add({
      rect: r,
      key,
      tap: () => {
        app.sfx.tap();
        app.shell.open(slot);
      },
    });
  });
}

export function drawSettings(
  app: App,
  state: App["screen"] & { kind: "settings" },
) {
  const { ctx } = app;
  const tr = app.tr();
  drawHub(app);
  app.held = true;
  const back = () => app.go({ kind: "hub" });
  shade(app, state.busy ? undefined : back);

  if (state.confirm > 0) {
    // Starting over, asked twice
    const msg =
      state.confirm === 1 ? tr.restartAsk(app.slot + 1) : tr.restartSure;
    const lines = wrap(ctx, msg, dialogPage(W - 80) - 40, 18);
    const h = Math.max(330, dialogHeight(44 + 130, lines.length, 26));
    const m = { x: 40, y: 290, w: W - 80, h };
    const paper = sheet(app, m, tr.restart);
    sprite(
      ctx,
      app.sprites.get(state.confirm === 1 ? "cake-box" : "fail-flat"),
      W / 2,
      paper.y + 60,
      110,
      90,
    );
    lines.forEach((l, i) => {
      text(ctx, l, W / 2, paper.y + 130 + i * 26, { size: 18 });
    });
    dialogButtons(app, m, [
      { key: "cancel", label: tr.cancel, onTap: back, disabled: state.busy },
      {
        key: "restart-go",
        label: state.confirm === 1 ? tr.goOn : tr.restartYes,
        fill: state.confirm === 1 ? C.green : "#f2a8a0",
        size: 20,
        weight: 1.5,
        disabled: state.busy,
        onTap: () => {
          if (state.confirm === 1) {
            app.go({ kind: "settings", confirm: 2 });
            return;
          }
          app.go({ kind: "settings", confirm: 2, busy: true });
          void app.shell.restart().then((ok) => {
            if (ok) {
              app.toast(tr.restarted, W / 2, 260, C.good, 24);
              return;
            }
            app.sfx.bad();
            app.go({ kind: "settings", confirm: 2 });
            app.toast(tr.loadFailed, W / 2, 260, C.bad, 18);
          });
        },
      },
    ]);
    return;
  }

  const m = { x: 40, y: 250, w: W - 80, h: 470 };
  const paper = sheet(app, m, tr.settings);
  close(app, m, back);
  const audio = app.rt.game.audio;
  const row = (i: number) => ({
    x: paper.x + 14,
    y: paper.y + 18 + i * 88,
    w: paper.w - 28,
    h: 72,
  });
  // Sound and music: a label and an on/off pill
  const toggle = (
    i: number,
    key: string,
    label: string,
    on: boolean,
    set: (on: boolean) => void,
  ) => {
    const r = row(i);
    text(ctx, label, r.x + 10, r.y + r.h / 2 + 2, {
      size: 22,
      align: "left",
    });
    btn(
      app,
      key,
      { x: r.x + r.w - 140, y: r.y + 4, w: 140, h: 64 },
      on ? tr.on : tr.off,
      () => set(!on),
      { fill: on ? C.green : "#e4dcd2", size: 21 },
    );
  };
  toggle(0, "sound", tr.sound, !audio.muted, (on) => audio.setMuted(!on));
  toggle(1, "music", tr.music, app.shell.music, (on) => app.shell.setMusic(on));
  btn(app, "switch", row(2), tr.switchShop, () => app.shell.pick(), {
    fill: "#c9cdea",
    size: 22,
  });
  btn(
    app,
    "restart",
    row(3),
    tr.restart,
    () => app.go({ kind: "settings", confirm: 1 }),
    { fill: "#f2c4bc", size: 22 },
  );
  text(ctx, tr.slotName(app.slot + 1), W / 2, m.y + m.h - 30, {
    size: 16,
    fill: C.muted,
  });
}
