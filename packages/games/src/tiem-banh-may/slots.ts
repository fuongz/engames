import { type App, W, close, icon, shade, sheet, viewRect } from "./app";
import {
  C,
  card,
  cover,
  noteIcon,
  restartIcon,
  shopIcon,
  speakerIcon,
  sprite,
  text,
  wrap,
} from "./art";
import { drawHub } from "./hub";
import { shopName } from "./name";
import {
  dialogButtons,
  dialogHeight,
  dialogPage,
  menuButton,
  toggle,
} from "./kit";

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
    // The bakery's own name, or "Tiệm 2" for an empty slot
    const title = save?.name || tr.slotName(slot + 1);
    text(ctx, title, tx, mid - 30, {
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

  const m = { x: 40, y: 190, w: W - 80, h: 604 };
  const paper = sheet(app, m, tr.settings);
  close(app, m, back);
  const audio = app.rt.game.audio;

  // Sound and music: an icon, its name, and a switch under it
  const sw = (
    cx: number,
    key: string,
    label: string,
    on: boolean,
    glyph: (cx: number, cy: number, s: number, on: boolean) => void,
    set: (on: boolean) => void,
  ) => {
    const iy = paper.y + 36;
    icon(app, `${key}-${on ? "on" : "off"}`, cx, iy, 56, () =>
      glyph(cx, iy, 56, on),
    );
    text(ctx, label, cx, paper.y + 82, { size: 18 });
    toggle(app, key, cx, paper.y + 124, on, () => set(!on));
  };
  sw(
    W / 2 - 100,
    "sound",
    tr.sound,
    !audio.muted,
    (x, y, s, on) => speakerIcon(ctx, x, y, s, on),
    (on) => audio.setMuted(!on),
  );
  sw(
    W / 2 + 100,
    "music",
    tr.music,
    app.shell.music,
    (x, y, s, on) => noteIcon(ctx, x, y, s, on),
    (on) => app.shell.setMusic(on),
  );

  // The rest as a list, each with its picture
  const row = (i: number) => ({
    x: paper.x + 6,
    y: paper.y + 170 + i * 84,
    w: paper.w - 12,
    h: 70,
  });
  menuButton(
    app,
    "switch",
    row(0),
    tr.switchShop,
    (x, y, s) => icon(app, "shop", x, y, s, () => shopIcon(ctx, x, y, s)),
    () => app.shell.pick(),
    { fill: "#c9cdea" },
  );
  menuButton(
    app,
    "tour-replay",
    row(1),
    tr.tour.replay,
    (x, y, s) => {
      // Mây herself, cropped to the circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, s / 1.5 - 1, 0, Math.PI * 2);
      ctx.clip();
      sprite(
        ctx,
        app.sprites.get("mascot-avatar"),
        x,
        y + s * 0.08,
        s * 1.3,
        s * 1.3,
      );
      ctx.restore();
    },
    () => {
      app.setTour(0);
      app.go({ kind: "hub" });
    },
    { fill: "#fff0bf" },
  );
  menuButton(
    app,
    "rename",
    row(2),
    tr.naming.rename,
    (x, y, s) =>
      sprite(ctx, app.sprites.get("f-basic-stand"), x, y, s * 1.4, s),
    () => app.go({ kind: "name", first: false }),
    { fill: "#dff3f6" },
  );
  menuButton(
    app,
    "restart",
    row(3),
    tr.restart,
    (x, y, s) => icon(app, "restart", x, y, s, () => restartIcon(ctx, x, y, s)),
    () => app.go({ kind: "settings", confirm: 1 }),
    { fill: "#f2c4bc" },
  );
  text(ctx, shopName(app.save, app.rt.locale()), W / 2, m.y + m.h - 30, {
    size: 16,
    fill: C.muted,
  });
}
