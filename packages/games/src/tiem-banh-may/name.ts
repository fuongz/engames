import type { Locale, Rect } from "@web-games/core";
import { type App, W, close, shade, sheet } from "./app";
import { C, FONT, panel, sprite, text } from "./art";
import { NAME_MAX, isControl } from "./config";
import { drawHub } from "./hub";
import { dialogButtons } from "./kit";
import type { SaveData } from "./logic";

// The bakery's name: every player names their own shop (on a new bakery, and
// from Settings). The canvas can't take typing, so a real <input> sits over the
// drawn field while the dialog is up; it is the only DOM the game adds.

const IDEAS: Record<Locale, string[]> = {
  vi: [
    "Tiệm Bánh Nhỏ Xinh",
    "Tiệm Bánh Ấm Áp",
    "Bánh Ngọt Góc Phố",
    "Tiệm Bánh Mây",
    "Lò Bánh Hạt Dẻ",
    "Tiệm Bánh Dâu Tây",
    "Bánh Nhà Làm",
    "Tiệm Bánh Nắng Mai",
  ],
  en: [
    "Cozy Little Bakery",
    "The Warm Oven",
    "Corner Sweets",
    "Cloud Bakery",
    "Chestnut Bakehouse",
    "Strawberry Bakery",
    "Homemade Bakes",
    "Morning Sun Bakery",
  ],
};

/** A few name ideas, picked by the bakery's seed so they stay put. */
export function nameIdeas(seed: number, locale: Locale, n = 3) {
  const list = IDEAS[locale];
  const start = Math.abs(seed) % list.length;
  return Array.from(
    { length: n },
    (_, i) => list[(start + i * 3) % list.length],
  );
}

/** Tidy what was typed: one line, single spaces, not too long. */
export function cleanName(raw: string) {
  return [...raw]
    .map((c) => (isControl(c) ? " " : c))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

/** What the shop is called, with a placeholder until it has a name. */
export const shopName = (save: SaveData, locale: Locale) =>
  save.name || nameIdeas(save.seed, locale, 1)[0];

// ---------------------------------------------------------------- the field

let field: HTMLInputElement | null = null;

/** The input over the canvas, created on first use. */
function input(app: App) {
  if (field?.isConnected) return field;
  const el = document.createElement("input");
  el.type = "text";
  el.maxLength = NAME_MAX;
  el.autocomplete = "off";
  el.spellcheck = false;
  el.enterKeyHint = "done";
  el.style.cssText = `position:absolute;z-index:2;border:none;outline:none;background:transparent;color:${C.text};font-family:${FONT};font-weight:700;text-align:center;padding:0;margin:0`;
  app.rt.root.style.position ||= "relative";
  app.rt.root.appendChild(el);
  field = el;
  return el;
}

/** Put the input over `r` (game units) this frame. */
function place(app: App, el: HTMLInputElement, r: Rect, size: number) {
  const { view, canvas } = app.rt.stage;
  const k = canvas.clientWidth / view.w;
  el.style.left = `${(r.x - view.x) * k}px`;
  el.style.top = `${(r.y - view.y) * k}px`;
  el.style.width = `${r.w * k}px`;
  el.style.height = `${r.h * k}px`;
  el.style.fontSize = `${size * k}px`;
}

/** Take the input away (the dialog closed, or the game is going). */
export function hideNameField() {
  field?.remove();
  field = null;
}

// ---------------------------------------------------------------- the dialog

export interface NameState {
  kind: "name";
  /** A new bakery: no way back, only "Done". */
  first: boolean;
}

export function drawName(app: App, s: NameState) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const el = input(app);
  const done = () => {
    const name = cleanName(el.value);
    if (!name) {
      app.sfx.bad();
      el.focus();
      return;
    }
    hideNameField();
    app.commit({ ...save, name }, { now: true });
    app.toast(tr.naming.saved, W / 2, 260, C.good, 22);
    app.go({ kind: "hub" });
  };
  const back = () => {
    hideNameField();
    app.go({ kind: "hub" });
  };
  if (!el.dataset.ready) {
    // First frame: start from the current name (or an idea) and wire Enter
    el.value = save.name;
    el.placeholder = nameIdeas(save.seed, locale, 1)[0];
    el.dataset.ready = "1";
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done();
    });
  }

  // Over the kitchen, which holds still meanwhile
  drawHub(app);
  app.held = true;
  shade(app, s.first ? undefined : back);
  const m = { x: 30, y: 240, w: W - 60, h: 370 };
  const paper = sheet(app, m, s.first ? tr.naming.titleNew : tr.naming.title);
  if (!s.first) close(app, m, back);

  sprite(ctx, app.sprites.get("mascot-happy"), W / 2, paper.y + 56, 100, 100);
  text(ctx, tr.naming.ask, W / 2, paper.y + 122, {
    size: 17,
    maxWidth: paper.w - 20,
  });
  // The field: a cream plank with the input over it
  const f = { x: paper.x + 10, y: paper.y + 146, w: paper.w - 20, h: 54 };
  panel(ctx, f, { fill: C.white, radius: 16, line: 2.5 });
  place(app, el, { x: f.x + 12, y: f.y + 4, w: f.w - 24, h: f.h - 8 }, 22);
  app.ui.add({ rect: f, tap: () => el.focus() });

  dialogButtons(app, m, [
    ...(s.first ? [] : [{ key: "name-cancel", label: tr.cancel, onTap: back }]),
    {
      key: "name-done",
      label: tr.naming.done,
      onTap: done,
      fill: C.green,
      weight: 1.5,
    },
  ]);
}
