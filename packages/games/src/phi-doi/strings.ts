import type { Localized } from "@web-games/core/i18n";
import type { PickupKind } from "./config";

// Every player-visible line in the game. game.ts resolves these at draw time, so
// switching language in the portal takes effect on the next frame.

export interface Strings {
  pickup: Record<Exclude<PickupKind, "coin">, string>;
  stage: (n: number) => string;
  stageClearTitle: string;
  stageClearSub: (n: number) => string;
  stageStartSub: string;
  warningStrip: string;
  warning: string;
  bossName: string;
  bombsFull: string;
  missionLine1: string;
  missionLine2: string;
  dragHint: string;
  paused: string;
  pauseScore: (score: number, stage: number) => string;
  keysHint: string;
  resume: string;
  restart: string;
  shotDown: string;
  resultLine: (stage: number, coins: number, ships: number) => string;
  newBest: string;
  best: (n: number) => string;
  flyAgain: string;
  /** Leaderboard detail, e.g. "Màn 2, 30 xu". */
  detail: (stage: number, coins: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    pickup: { power: "Tăng hỏa lực!", bomb: "+1 bom", heal: "Sửa máy bay" },
    stage: (n) => `Màn ${n}`,
    stageClearTitle: "HOÀN THÀNH",
    stageClearSub: (n) => `Màn ${n}: đã đánh chìm chiến hạm`,
    stageStartSub: "Địch đông hơn và bắn nhanh hơn",
    warningStrip: "!!! CẨN THẬN",
    warning: "CẢNH BÁO",
    bossName: "CHIẾN HẠM",
    bombsFull: "đầy",
    missionLine1: "Nhiệm vụ: sống sót qua",
    missionLine2: "trận không chiến!",
    dragHint: "Kéo ngón tay ở bất kỳ đâu để bay",
    paused: "Tạm Dừng",
    pauseScore: (score, stage) => `Điểm: ${score} | Màn ${stage}`,
    keysHint: "Phím: WASD bay | J hỏa lực | Space bom",
    resume: "Tiếp tục",
    restart: "Chơi lại",
    shotDown: "Bị Bắn Hạ!",
    resultLine: (stage, coins, ships) =>
      `Màn ${stage} | ${coins} xu | ${ships} chiến hạm`,
    newBest: "Kỷ lục mới!",
    best: (n) => `Kỷ lục ${n}`,
    flyAgain: "Bay lại",
    detail: (stage, coins) => `Màn ${stage}, ${coins} xu`,
  },
  en: {
    pickup: { power: "Firepower up!", bomb: "+1 bomb", heal: "Plane repaired" },
    stage: (n) => `Stage ${n}`,
    stageClearTitle: "STAGE CLEAR",
    stageClearSub: (n) => `Stage ${n}: battleship sunk`,
    stageStartSub: "More enemies, faster fire",
    warningStrip: "!!! BEWARE",
    warning: "WARNING",
    bossName: "BATTLESHIP",
    bombsFull: "full",
    missionLine1: "Your mission: survive",
    missionLine2: "the air battle!",
    dragHint: "Drag anywhere to fly",
    paused: "Paused",
    pauseScore: (score, stage) => `Score: ${score} | Stage ${stage}`,
    keysHint: "Keys: WASD fly | J firepower | Space bomb",
    resume: "Resume",
    restart: "Restart",
    shotDown: "Shot Down!",
    resultLine: (stage, coins, ships) =>
      `Stage ${stage} | ${coins} coins | ${ships} ${ships === 1 ? "ship" : "ships"} sunk`,
    newBest: "New best!",
    best: (n) => `Best ${n}`,
    flyAgain: "Fly again",
    detail: (stage, coins) => `Stage ${stage}, ${coins} coins`,
  },
};
