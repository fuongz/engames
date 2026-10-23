import type { GameModule } from "../core/types";
import { startGame } from "./game";

const game: GameModule = {
  mount: (root, ctx) => startGame(root, ctx),
};

export default game;
