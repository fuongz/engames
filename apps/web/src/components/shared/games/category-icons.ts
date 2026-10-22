import { Chess01Icon, Compass01Icon, Fire02Icon, FootballIcon, PuzzleIcon, Sword03Icon } from "@hugeicons/core-free-icons";

export const ALL_CATEGORIES = "all";

/** One icon per category id (plus "all"), shared by the library chips and the search palette. */
export const CATEGORY_ICONS: Record<string, typeof Fire02Icon> = {
  [ALL_CATEGORIES]: Fire02Icon,
  "hanh-dong": Sword03Icon,
  "chien-thuat": Chess01Icon,
  "tri-tue": PuzzleIcon,
  "phieu-luu": Compass01Icon,
  "the-thao": FootballIcon,
};

export const categoryIcon = (id: string) => CATEGORY_ICONS[id] ?? Fire02Icon;
