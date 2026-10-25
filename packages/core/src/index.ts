// The engine's public surface, for games and the portal alike. The files behind
// it are free to move. Pure code (logic.ts, the realtime Worker) imports the
// narrower entry points instead: @web-games/core/math, /i18n and /online.

export { type AudioBus, type MusicLoop, type ToneOptions, audioBus } from "./audio";
export {
  type GameHooks,
  type GameSpec,
  type Runtime,
  defineGame,
  fixedSteps,
} from "./game";
export {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type Localized,
  currentLocale,
  isLocale,
} from "./i18n";
export * from "./math";
export { InputLog, approach } from "./net";
export { type PointerInfo, Stage, type StageHandlers } from "./stage";
export { type GameStorage, createStorage } from "./storage";
export { fitFontSize } from "./text";
export {
  type CloudSave,
  type CloudSaveResult,
  type CloudSlot,
  type GameCategory,
  type GameContext,
  type GameInstance,
  type GameManifest,
  type GameModule,
  type OnlineMatch,
  type ScoreReport,
  SUMMARY_KEY,
  summaryText,
} from "./types";
