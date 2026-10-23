// The engine's public surface. Games import from "../core"; the files behind it
// are free to move.

export type { AudioBus, ToneOptions } from "./audio";
export {
  type GameHooks,
  type GameSpec,
  type Runtime,
  defineGame,
  fixedSteps,
} from "./game";
export { type Locale, type Localized, currentLocale } from "./i18n";
export * from "./math";
export { InputLog, approach } from "./net";
export { type PointerInfo, Stage, type StageHandlers } from "./stage";
export type { GameStorage } from "./storage";
export { fitFontSize } from "./text";
export {
  type GameContext,
  type GameInstance,
  type GameManifest,
  type GameModule,
  type OnlineMatch,
  SUMMARY_KEY,
} from "./types";
