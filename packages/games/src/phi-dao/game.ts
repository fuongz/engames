import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, type Runtime, SUMMARY_KEY } from "@web-games/core";
import { backdrop, knife, type KnifeSprites, pill, target, text } from "./art";
import {
  CX,
  CY,
  H,
  isKnifeSkin,
  KNIFE_EFFECTS,
  KNIFE_SKINS,
  type KnifeSkin,
  PALETTE as P,
  RUN_SECONDS,
  W,
} from "./config";
import { createKnifeEffects } from "./effects";
import classicUrl from "./img/knife-classic.webp";
import dragonUrl from "./img/knife-dragon.webp";
import orchardUrl from "./img/orchard.webp";
import targetUrl from "./img/target.webp";
import stormSheetUrl from "./img/storm-impact-sheet.webp";
import { createRun, type Event, type Run, step } from "./logic";
import { createKnifeShop } from "./shop";
import { SHOP_STRINGS, STRINGS } from "./strings";

export function setup(rt: Runtime): GameHooks {
  const { ctx: c, stage, game } = rt;
  const online = game.online;
  const motionPreference =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const reduced = () => motionPreference?.matches ?? false;
  let lastReduced = reduced();
  const fx = createKnifeEffects();
  const stormSheet = new Image();
  stormSheet.src = stormSheetUrl;
  let selected: KnifeSkin = "classic";
  const sprites: KnifeSprites = {};
  for (const [skin, url] of [
    ["classic", classicUrl],
    ["dragon", dragonUrl],
  ] as const) {
    const sprite = new Image();
    sprite.src = url;
    sprites[skin] = sprite;
  }
  const look = () => ({
    sprites,
    time: fx.time,
    reduced: reduced(),
    impactAge: (k: Run["knives"][number]) => fx.impactAge(k, state.stage),
  });
  function selectKnife(skin: KnifeSkin) {
    if (!shop.owned(skin)) {
      if (!online || state.phase === "over") {
        pending = [false, false];
        shop.show(skin);
      }
      return;
    }
    void shop.equip(skin);
  }
  const shop = createKnifeShop({
    service: game.cosmetics,
    online: Boolean(online),
    sprites,
    locale: () => rt.locale(),
    reduced,
    onInventory(inventory) {
      selected =
        isKnifeSkin(inventory.equipped) &&
        inventory.owned.includes(inventory.equipped)
          ? inventory.equipped
          : "classic";
    },
  });
  void shop.refresh();
  const tr = () => STRINGS[rt.locale()];
  const image = new Image();
  image.src = orchardUrl;
  const wood = new Image();
  wood.src = targetUrl;
  let state = createRun(
    online?.seed ?? Math.floor(Math.random() * 100000),
    online?.seats.length ?? 1,
  );
  let screen: "menu" | "play" = online ? "play" : "menu";
  let paused = false;
  let received = !online;
  let clock = 0;
  let seq = 0;
  let pending = [false, false];
  let reported = false;
  let overTime = 0;
  let flash = 0;
  let clear = 0;
  let shake = 0;
  let notice: "clear" | "miss" = "clear";
  const sparks: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
  }[] = [];

  function effects(events: Event[]) {
    for (const e of events) {
      fx.event(e, state, reduced());
      if (e.type === "hit" || e.type === "clear") {
        game.audio.tone({
          freq: e.type === "clear" ? 784 : 400 + state.remaining * 30,
          dur: 0.12,
          type: "triangle",
          vol: 0.06,
        });
        if (e.type === "clear") {
          clear = reduced() ? 0 : 0.8;
          flash = 1;
          notice = "clear";
        }
        for (let i = 0; i < (e.type === "clear" && !reduced() ? 35 : 0); i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 50 + Math.random() * 200;
          sparks.push({
            x: CX,
            y: CY,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            life: 0.7,
            color: e.seat === 1 ? P.coral : P.orange,
          });
        }
      } else if (e.type === "miss") {
        shake = reduced() ? 0 : 0.15;
        flash = 1;
        notice = "miss";
        game.audio.tone({
          freq: 160,
          to: 60,
          dur: 0.22,
          type: "triangle",
          vol: 0.09,
        });
      }
    }
  }
  const unsubscribe = online?.onMessage((m) => {
    if (m.t === "snap") {
      state = m.state as Run;
      received = true;
    } else if (m.t === "ev") effects(m.events as Event[]);
    else if (m.t === "end") {
      state.phase = "over";
    }
  });
  function begin(players: number) {
    state = createRun(Math.floor(Math.random() * 100000), players);
    screen = "play";
    pending = [false, false];
    reported = false;
    overTime = 0;
    sparks.length = 0;
    fx.reset();
  }
  function act(x: number, y: number) {
    if (shop.isOpen) {
      shop.down(x, y);
      return;
    }
    if (paused) {
      paused = false;
      pending = [false, false];
      return;
    }
    if (screen === "menu") {
      if (y >= 773 && y <= 825) {
        shop.show();
        return;
      }
      if (y >= 442 && y <= 524 && x >= 44 && x <= W - 44) {
        selectKnife(x < CX ? "classic" : "dragon");
        return;
      }
      if (y >= 535 && y <= 603) begin(1);
      else if (y >= 615 && y <= 683) begin(2);
      return;
    }
    if (!received || online?.seat === -1) return;
    if (state.phase === "over") {
      if (overTime < 0.75) return;
      if (y >= 546 && y <= 610) {
        if (online) online.backToLobby();
        else begin(state.players);
      } else if (!online && y >= 625 && y <= 687) screen = "menu";
      return;
    }
    if (y >= 624 && y <= 662 && x >= 44 && x <= W - 44) {
      selectKnife(x < CX ? "classic" : "dragon");
      return;
    }
    pending[online ? online.seat : state.players === 2 && x >= W / 2 ? 1 : 0] =
      true;
  }
  function update(dt: number) {
    if (lastReduced !== reduced()) {
      fx.reset();
      sparks.length = 0;
      shake = 0;
      clear = 0;
      lastReduced = reduced();
    }
    if (!paused) fx.update(dt);
    flash = Math.max(0, flash - dt * 2);
    clear = Math.max(0, clear - dt);
    shake = Math.max(0, shake - dt);
    for (const p of sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
    }
    for (let i = sparks.length - 1; i >= 0; i--)
      if (sparks[i].life <= 0) sparks.splice(i, 1);
    if (screen !== "play" || (shop.isOpen && !online)) return;
    if (online) {
      clock += dt;
      if (clock >= 1 / online.tickRate) {
        clock %= 1 / online.tickRate;
        const fire = pending[online.seat];
        if (fire && online.seat >= 0 && !paused && state.phase !== "over")
          online.send({
            seq: ++seq,
            move: { x: 0, y: 0 },
            actions: [{ type: "throw", skin: selected }],
          });
        pending = [false, false];
      }
    } else if (!paused) {
      effects(
        step(
          state,
          dt,
          pending.map((fire) => (fire ? { skin: selected } : null)),
        ),
      );
      pending = [false, false];
    }
    if (state.phase === "over") {
      overTime += dt;
      if (!online && !reported) {
        reported = true;
        // Solo scores alone enter the solo board; a two-player run shares its score on screen.
        if (state.players === 1) {
          game.reportScore?.({
            score: state.score,
            detail: `${tr().stage} ${state.stage}/15`,
          });
          const best = Math.max(
            game.storage.get<number>("best", 0),
            state.score,
          );
          game.storage.set("best", best);
          game.storage.set(SUMMARY_KEY, {
            vi: `${best} điểm`,
            en: `${best} points`,
          });
        }
      }
    }
  }
  function button(y: number, label: string, color: string = P.orange) {
    pill(c, 44, y, W - 88, 64, color);
    text(c, label, CX, y + 33, 25, P.ink);
  }
  function drawSkinChoices(menu: boolean) {
    for (const [i, skin] of KNIFE_SKINS.entries()) {
      const x = i === 0 ? 44 : 252;
      const y = menu ? 446 : 624;
      const width = 184;
      const chosen = selected === skin;
      pill(c, x, y, width, menu ? 73 : 38, chosen ? P.sky : P.panel);
      if (chosen) {
        c.strokeStyle = KNIFE_EFFECTS[skin].color;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(x, y, width, menu ? 73 : 38, 18);
        c.stroke();
      }
      const name = skin === "classic" ? tr().classicKnife : tr().dragonKnife;
      if (menu) {
        knife(c, x + 28, y + 39, 0, -1, 0.7, { ...look(), skin });
        text(c, name, x + 111, y + 23, 19, KNIFE_EFFECTS[skin].color);
        text(
          c,
          skin === "classic"
            ? tr().classicEffect
            : shop.owned(skin)
              ? tr().dragonEffect
              : `${(2000).toLocaleString(rt.locale())} ${SHOP_STRINGS[rt.locale()].tickets}`,
          x + 111,
          y + 49,
          12,
          P.muted,
        );
      } else
        text(
          c,
          `${i + 1}. ${name}${shop.owned(skin) ? "" : " (2K)"}`,
          x + width / 2,
          y + 20,
          16,
          chosen ? KNIFE_EFFECTS[skin].color : P.muted,
        );
    }
  }
  function render() {
    stage.begin();
    backdrop(c, image);
    if (shop.isOpen) {
      shop.draw(c, fx.time);
      stage.end();
      return;
    }
    if (screen === "menu") {
      text(c, tr().subtitle, CX, 112, 18, P.muted);
      text(c, tr().title, CX, 161, rt.locale() === "en" ? 49 : 64);
      target(
        c,
        { ...state, angle: reduced() ? 0 : Math.sin(fx.time / 3) * 0.15 },
        wood,
        look(),
      );
      text(c, tr().tryKnives, CX, 425, 16, P.muted);
      drawSkinChoices(true);
      button(539, tr().solo);
      button(619, tr().duo, P.cyan);
      text(c, tr().hint, CX, 714, 17, P.muted);
      text(c, tr().onlineHint, CX, 750, 14, P.muted);
      pill(c, 44, 773, W - 88, 48, P.panel);
      text(c, `${SHOP_STRINGS[rt.locale()].title} [B]`, CX, 798, 20, P.orange);
    } else {
      c.save();
      if (shake) c.translate(Math.sin(shake * 150) * 5, 0);
      const boss = state.stage % 5 === 0;
      text(
        c,
        boss ? tr().boss : `${tr().stage} ${state.stage} / 15`,
        CX,
        54,
        21,
        boss ? P.orange : P.cream,
      );
      pill(c, 22, 86, 130, 70);
      text(c, tr().score, 87, 104, 12, P.muted);
      text(c, String(state.score), 87, 132, 27);
      pill(c, W - 152, 86, 130, 70);
      text(c, "●".repeat(Math.max(0, state.lives)), W - 87, 112, 24, P.coral);
      text(
        c,
        `${Math.max(0, Math.ceil(RUN_SECONDS - state.elapsed))}s`,
        W - 87,
        140,
        15,
        P.muted,
      );
      c.save();
      if (clear > 0) {
        c.translate(CX, CY);
        c.scale(1 + (0.8 - clear) * 0.15, 1 + (0.8 - clear) * 0.15);
        c.translate(-CX, -CY);
        c.globalAlpha = clear / 0.8;
      }
      target(c, state, wood, look());
      c.restore();
      fx.draw(c, sprites, reduced(), stormSheet);
      if (!fx.hasFlight() && state.phase === "play")
        knife(c, CX, 595, 0, online?.seat ?? 0, 1, {
          ...look(),
          skin: selected,
        });
      drawSkinChoices(false);
      for (const p of sparks) {
        c.globalAlpha = Math.max(0, p.life / 0.7);
        c.fillStyle = p.color;
        c.fillRect(p.x, p.y, 5, 5);
      }
      c.globalAlpha = 1;
      text(c, `${state.remaining} ${tr().left}`, CX, 489, 19, P.muted);
      if (flash > 0) {
        c.globalAlpha = flash;
        text(
          c,
          tr()[notice],
          CX,
          528,
          26,
          notice === "miss" ? P.coral : P.orange,
        );
        c.globalAlpha = 1;
      }
      const duo = state.players === 2 && !online;
      if (duo) {
        pill(c, 20, 666, 212, 105);
        pill(c, 248, 666, 212, 105);
        text(c, `1: ${tr().throw} [A]`, 126, 703, 22, P.cyan);
        text(c, `2: ${tr().throw} [L]`, 354, 703, 22, P.coral);
        text(c, String(state.hits[0]), 126, 744, 21);
        text(c, String(state.hits[1]), 354, 744, 21);
      } else {
        button(685, tr().throw, online?.seat === 1 ? P.coral : P.cyan);
        text(
          c,
          online ? tr().team : tr().hint,
          CX,
          785,
          online ? 14 : 17,
          P.muted,
        );
      }
      if (duo) text(c, tr().team, CX, 802, 14, P.muted);
      c.restore();
      if (!received) {
        pill(c, 20, 365, W - 40, 80);
        text(c, tr().waiting, CX, 405, 21);
      }
      if (state.phase === "over") {
        c.fillStyle = "rgba(9,30,39,0.85)";
        c.fillRect(0, 170, W, 550);
        text(c, state.won ? tr().won : tr().over, CX, 285, 32);
        text(c, String(state.score), CX, 375, 76, P.orange);
        text(c, `${tr().stage} ${state.stage} / 15`, CX, 447, 22, P.muted);
        if (state.players === 2)
          text(
            c,
            `1: ${state.hits[0]},  2: ${state.hits[1]}`,
            CX,
            495,
            20,
            P.muted,
          );
        button(546, online ? tr().lobby : tr().again);
        if (!online) button(625, tr().menu, P.cyan);
      }
      if (paused) {
        c.fillStyle = "rgba(9,30,39,0.9)";
        c.fillRect(0, 0, W, H);
        text(c, tr().paused, CX, 370, 36);
        text(c, tr().resume, CX, 430, 22, P.muted);
      }
    }
    stage.end();
  }
  return {
    update,
    render,
    pointer: { down: (p) => act(p.x, p.y) },
    keydown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof Element &&
        e.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]',
        )
      )
        return;
      if (e.repeat) return;
      if (shop.isOpen) {
        if (
          [
            "Escape",
            "Digit1",
            "Digit2",
            "ArrowLeft",
            "ArrowRight",
            "Tab",
            "Enter",
            "Space",
          ].includes(e.code)
        ) {
          e.preventDefault();
          shop.key(e.code);
        }
        return;
      }
      if (e.code === "KeyB" && (!online || state.phase === "over")) {
        e.preventDefault();
        pending = [false, false];
        shop.show();
        return;
      }
      if (
        e.repeat ||
        !["Space", "Enter", "KeyA", "KeyL", "Digit1", "Digit2"].includes(e.code)
      )
        return;
      e.preventDefault();
      if (e.code === "Digit1" || e.code === "Digit2") {
        selectKnife(e.code === "Digit1" ? "classic" : "dragon");
        return;
      }
      if (screen === "menu") {
        begin(e.code === "KeyL" ? 2 : 1);
        return;
      }
      if (state.phase === "over" || paused) {
        act(CX, 570);
        return;
      }
      if (state.players === 2 && !online && e.code === "KeyL") act(W - 80, 720);
      else act(80, 720);
    },
    suspend() {
      pending = [false, false];
      if (!online && screen === "play" && state.phase === "play") paused = true;
    },
    dispose() {
      unsubscribe?.();
      fx.reset();
      shop.dispose();
      for (const sprite of Object.values(sprites)) sprite.src = "";
      image.src = "";
      wood.src = "";
      stormSheet.src = "";
    },
  };
}
