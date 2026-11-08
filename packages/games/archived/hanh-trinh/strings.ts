import type { Localized } from "@web-games/core/i18n";

// Every line the game draws, per locale. Weapon, shield and foe names live with
// their stats in config.ts. "MISS" and "MAX" read the same in both languages.

export interface Strings {
  miss: string;
  block: string;
  damageGain: (n: number) => string;
  hpGain: (n: number) => string;
  max: string;
  tapToUpgrade: string;
  defeat: string;
  kills: (n: number) => string;
  best: (n: number) => string;
  playAgain: string;
  summary: (n: number) => string;
  /** Thousands separators on gold and prices. */
  numberLocale: string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    miss: "MISS",
    block: "CHẶN",
    damageGain: (n) => `+${n} sát thương`,
    hpGain: (n) => `+${n} máu`,
    max: "MAX",
    tapToUpgrade: "Chạm để nâng cấp!",
    defeat: "THẤT BẠI",
    kills: (n) => `Hạ gục ${n} quái`,
    best: (n) => `Kỷ lục: ${n} quái`,
    playAgain: "CHƠI LẠI",
    summary: (n) => `Kỷ lục ${n} quái`,
    numberLocale: "vi-VN",
  },
  en: {
    miss: "MISS",
    block: "BLOCK",
    damageGain: (n) => `+${n} damage`,
    hpGain: (n) => `+${n} HP`,
    max: "MAX",
    tapToUpgrade: "Tap to upgrade!",
    defeat: "DEFEAT",
    kills: (n) => `${n} foes defeated`,
    best: (n) => `Best: ${n} kills`,
    playAgain: "PLAY AGAIN",
    summary: (n) => `Best ${n} kills`,
    numberLocale: "en-US",
  },
};
