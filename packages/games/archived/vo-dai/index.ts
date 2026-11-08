import { defineGame } from "@web-games/core";
import { FPS, H, W } from "./config";
import { setup } from "./game";

// A fighting game steps at a fixed 60 Hz: frame data and, later, rollback
// netcode both count frames, so a 120 Hz phone must not fight faster.
export default defineGame(
  { width: W, height: H, bleed: true, fonts: ['800 20px "Handjet"'], fixedStep: 1 / FPS },
  setup,
);
