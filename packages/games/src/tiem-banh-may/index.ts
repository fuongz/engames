import { defineGame } from "../core";
import { H, W } from "./config";
import { setup } from "./game";

export default defineGame(
  {
    width: W,
    height: H,
    bleed: true,
    fonts: ['700 20px "Mali"', '600 20px "Mali"'],
  },
  setup,
);
