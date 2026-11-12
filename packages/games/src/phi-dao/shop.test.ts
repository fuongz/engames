import type { CosmeticInventory, GameCosmetics } from "@web-games/core";
import { describe, expect, it, vi } from "vitest";
import { createKnifeShop } from "./shop";
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const inventory = (): CosmeticInventory => ({
  signedIn: true,
  balance: 3000,
  owned: ["classic"],
  equipped: "classic",
});
function harness(signedIn = true) {
  let state = inventory();
  state.signedIn = signedIn;
  let selected = "classic";
  const service: GameCosmetics = {
    state: vi.fn(async () => state),
    buy: vi.fn(async () => {
      state = { ...state, balance: 1000, owned: ["classic", "dragon"] };
      return { ok: true, inventory: state };
    }),
    equip: vi.fn(async (id) => {
      state = { ...state, equipped: id };
      return state;
    }),
    signIn: vi.fn(async () => {}),
  };
  const shop = createKnifeShop({
    service,
    online: false,
    sprites: {},
    locale: () => "vi",
    reduced: () => false,
    onInventory: (i) => {
      selected = i.equipped;
    },
  });
  return { shop, service, selected: () => selected };
}
describe("in-game knife workshop", () => {
  it("never equips a locked knife; purchase requires confirmation, then a separate equip", async () => {
    const { shop, service, selected } = harness();
    await shop.show("dragon");
    await shop.equip("dragon");
    expect(service.equip).not.toHaveBeenCalled();
    expect(selected()).toBe("classic");
    shop.key("Enter");
    expect(service.buy).not.toHaveBeenCalled();
    shop.key("Enter");
    await settle();
    expect(service.buy).toHaveBeenCalledTimes(1);
    expect(shop.owned("dragon")).toBe(true);
    expect(selected()).toBe("classic");
    shop.key("Enter");
    await settle();
    expect(service.equip).toHaveBeenCalledWith("dragon");
    expect(selected()).toBe("dragon");
    expect(service.buy).toHaveBeenCalledTimes(1);
  });
  it("cancels confirmation without spending", async () => {
    const { shop, service } = harness();
    await shop.show("dragon");
    shop.key("Enter");
    shop.key("Escape");
    shop.key("Escape");
    expect(shop.isOpen).toBe(false);
    expect(service.buy).not.toHaveBeenCalled();
  });
  it("routes a guest to sign in instead of purchasing", async () => {
    const { shop, service } = harness(false);
    await shop.show("dragon");
    shop.key("Enter");
    await settle();
    expect(service.signIn).toHaveBeenCalledTimes(1);
    expect(service.buy).not.toHaveBeenCalled();
  });
  it("does not buy during an online match", async () => {
    const { service } = harness();
    const shop = createKnifeShop({
      service,
      online: true,
      sprites: {},
      locale: () => "vi",
      reduced: () => false,
      onInventory() {},
    });
    await shop.show("dragon");
    shop.key("Enter");
    shop.key("Enter");
    await settle();
    expect(service.buy).not.toHaveBeenCalled();
  });
  it("ignores inventory arriving after teardown", async () => {
    const { shop, service, selected } = harness();
    vi.mocked(service.state).mockResolvedValue({
      ...inventory(),
      owned: ["classic", "dragon"],
      equipped: "dragon",
    });
    const pending = shop.refresh();
    shop.dispose();
    await pending;
    expect(selected()).toBe("classic");
  });
});
