import {
  fitFontSize,
  type CosmeticInventory,
  type GameCosmetics,
  type Locale,
} from "@web-games/core";
import { FONT, knife, type KnifeSprites, pill, text } from "./art";
import {
  COSMETICS,
  CX,
  H,
  KNIFE_EFFECTS,
  KNIFE_SKINS,
  type KnifeSkin,
  PALETTE as P,
  W,
} from "./config";
import { SHOP_STRINGS } from "./strings";

/** Account inventory is the only source of ownership. A locked skin can be inspected, never equipped. */
export function createKnifeShop(options: {
  service?: GameCosmetics;
  online: boolean;
  sprites: KnifeSprites;
  locale: () => Locale;
  reduced: () => boolean;
  onInventory: (inventory: CosmeticInventory) => void;
}) {
  let inventory: CosmeticInventory = {
    signedIn: false,
    balance: null,
    owned: ["classic"],
    equipped: "classic",
  };
  let open = false;
  let busy = false;
  let loaded = false;
  let confirm = false;
  let disposed = false;
  let focus: KnifeSkin = "dragon";
  let message: "error" | "bought" | "insufficient" | null = null;
  const tr = () => SHOP_STRINGS[options.locale()];
  const apply = (next: CosmeticInventory) => {
    if (!disposed) {
      inventory = next;
      options.onInventory(next);
    }
  };
  async function refresh() {
    if (busy) return;
    busy = true;
    message = null;
    try {
      if (options.service) apply(await options.service.state());
      loaded = true;
    } catch {
      message = "error";
    } finally {
      busy = false;
    }
  }
  async function equip(skin: KnifeSkin) {
    if (busy || !inventory.owned.includes(skin)) return;
    if (!inventory.signedIn && skin === "classic") {
      apply({ ...inventory, equipped: "classic" });
      return;
    }
    if (!options.service) return;
    busy = true;
    message = null;
    try {
      apply(await options.service.equip(skin));
    } catch {
      message = "error";
    } finally {
      busy = false;
    }
  }
  async function purchase() {
    if (busy || !options.service || options.online || !inventory.signedIn)
      return;
    confirm = false;
    busy = true;
    message = null;
    try {
      const result = await options.service.buy("dragon");
      apply(result.inventory);
      message = result.ok
        ? "bought"
        : result.reason === "insufficient"
          ? "insufficient"
          : "error";
    } catch {
      message = "error";
    } finally {
      busy = false;
    }
  }
  function choose(skin: KnifeSkin) {
    if (!busy) {
      focus = skin;
      confirm = false;
      message = null;
    }
  }
  function primary() {
    if (busy) return;
    if (message === "error" || !loaded) {
      void refresh();
      return;
    }
    if (inventory.owned.includes(focus)) {
      if (inventory.equipped !== focus) void equip(focus);
      return;
    }
    if (!options.service || options.online) return;
    if (!inventory.signedIn) {
      busy = true;
      void (
        options.service.signIn?.() ??
        Promise.reject(new Error("sign-in-unavailable"))
      )
        .catch(() => {
          message = "error";
        })
        .finally(() => {
          busy = false;
        });
      return;
    }
    if (
      (inventory.balance ?? 0) <
      (COSMETICS.find((i) => i.id === focus)?.price ?? Infinity)
    ) {
      message = "insufficient";
      return;
    }
    confirm = true;
  }
  const button = (
    c: CanvasRenderingContext2D,
    y: number,
    label: string,
    color: string = P.orange,
  ) => {
    pill(c, 44, y, W - 88, 62, color);
    text(c, label, CX, y + 32, fitFontSize(c, label, 23, W - 120, FONT), P.ink);
  };
  return {
    refresh,
    equip,
    owned: (skin: KnifeSkin) => inventory.owned.includes(skin),
    get isOpen() {
      return open;
    },
    show(skin: KnifeSkin = "dragon") {
      open = true;
      focus = skin;
      confirm = false;
      return refresh();
    },
    dispose() {
      disposed = true;
    },
    down(x: number, y: number) {
      if (busy) return;
      if (confirm) {
        if (y >= 450 && y <= 512 && x >= 44 && x <= W - 44) void purchase();
        else if (y >= 530 && y <= 592) confirm = false;
        return;
      }
      if (y >= 180 && y <= 530) choose(x < CX ? "classic" : "dragon");
      else if (y >= 620 && y <= 682 && x >= 44 && x <= W - 44) primary();
      else if (y >= 722 && y <= 784) open = false;
    },
    key(code: string) {
      if (busy) return;
      if (code === "Escape") {
        if (confirm) confirm = false;
        else open = false;
        return;
      }
      if (confirm) {
        if (code === "Enter" || code === "Space") void purchase();
        return;
      }
      if (code === "Digit1" || code === "ArrowLeft") choose("classic");
      else if (code === "Digit2" || code === "ArrowRight") choose("dragon");
      else if (code === "Tab")
        choose(focus === "classic" ? "dragon" : "classic");
      else if (code === "Enter" || code === "Space") primary();
    },
    draw(c: CanvasRenderingContext2D, time: number) {
      const l = tr();
      c.fillStyle = P.sky;
      c.fillRect(0, 0, W, H);
      text(c, l.title, CX, 68, 36);
      text(c, l.balance, CX, 116, 14, P.muted);
      text(
        c,
        inventory.balance === null
          ? "—"
          : `${inventory.balance.toLocaleString(options.locale())} ${l.tickets}`,
        CX,
        146,
        25,
        P.orange,
      );
      for (const [i, skin] of KNIFE_SKINS.entries()) {
        const x = i === 0 ? 20 : 252;
        pill(c, x, 180, 208, 350);
        if (focus === skin) {
          c.strokeStyle = KNIFE_EFFECTS[skin].color;
          c.lineWidth = 2;
          c.beginPath();
          c.roundRect(x, 180, 208, 350, 18);
          c.stroke();
        }
        knife(c, x + 104, 333, 0, -1, 2.5, {
          skin,
          sprites: options.sprites,
          time,
          reduced: options.reduced(),
        });
        text(
          c,
          COSMETICS[i]?.name[options.locale()] ?? skin,
          x + 104,
          456,
          22,
          KNIFE_EFFECTS[skin].color,
        );
        const owned = inventory.owned.includes(skin);
        text(
          c,
          owned
            ? inventory.equipped === skin
              ? l.equipped
              : l.owned
            : l.locked,
          x + 104,
          488,
          16,
          P.muted,
        );
        text(
          c,
          skin === "classic"
            ? l.free
            : `${(COSMETICS[i]?.price ?? 0).toLocaleString(options.locale())} ${l.tickets}`,
          x + 104,
          514,
          17,
          P.orange,
        );
      }
      text(
        c,
        focus === "classic" ? l.basic : l.premium,
        CX,
        558,
        17,
        KNIFE_EFFECTS[focus].color,
      );
      text(c, l.cosmetic, CX, 587, 13, P.muted);
      const owned = inventory.owned.includes(focus);
      const label = busy
        ? l.busy
        : message === "error"
          ? l.retry
          : !loaded
            ? l.loading
            : owned
              ? inventory.equipped === focus
                ? l.equipped
                : l.equip
              : !options.service
                ? l.unavailable
                : options.online
                  ? l.online
                  : !inventory.signedIn
                    ? l.signIn
                    : l.buy;
      button(c, 620, label, busy ? P.muted : owned ? P.cyan : P.orange);
      if (message)
        text(
          c,
          l[message],
          CX,
          703,
          options.locale() === "en" ? 13 : 14,
          message === "error" ? P.coral : P.cream,
        );
      button(c, 722, l.close, P.cyan);
      text(c, l.hint, CX, 809, 13, P.muted);
      if (confirm) {
        c.fillStyle = "rgba(9,30,39,0.94)";
        c.fillRect(0, 180, W, 530);
        text(c, l.confirm, CX, 300, 30);
        text(
          c,
          l.confirmHint,
          CX,
          355,
          options.locale() === "en" ? 17 : 20,
          P.muted,
        );
        text(
          c,
          `${inventory.balance?.toLocaleString(options.locale())} → ${Math.max(0, (inventory.balance ?? 0) - 2000).toLocaleString(options.locale())} ${l.tickets}`,
          CX,
          400,
          22,
          P.orange,
        );
        button(c, 450, l.confirmBuy);
        button(c, 530, l.cancel, P.cyan);
      }
    },
  };
}
