import { defineGame } from "@web-games/core";
import { H, W } from "./config";
import { setup } from "./game";

export default defineGame(
  { width: W, height: H, fixedStep: 1 / 60, fonts: ['800 32px "Baloo 2"'] },
  setup,
);
