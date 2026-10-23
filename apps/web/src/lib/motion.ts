// Shared Motion vocabulary, so every animated surface moves the same way.
// The curves mirror `--ease-out` / `--ease-in-out` in styles/app.css.

/** Entering and exiting UI. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Things moving across the screen. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** Gesture settle: carries the release velocity, no overshoot past the slide. */
export const SETTLE_SPRING = {
  type: "spring",
  duration: 0.5,
  bounce: 0,
} as const;

/** A flick commits even when short: px per ms, measured over the drag. */
export const FLICK_VELOCITY = 0.11;

/** A "you are here" marker gliding between nav items; interruptible mid-glide. */
export const INDICATOR_SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const;

/** A staged entrance step: 300ms, as better-ui sets it. */
export const ENTER = { duration: 0.3, ease: EASE_OUT } as const;
/** Exits are shorter than enters. */
export const EXIT = { duration: 0.15, ease: EASE_OUT } as const;

/**
 * Staged entrance for a few large pieces (titles, copy, actions): opacity, a
 * 4px blur and a 12px rise. Blur is costly, so it stays off long lists.
 */
export const RISE_BLUR = {
  hidden: { opacity: 0, filter: "blur(4px)", transform: "translateY(12px)" },
  shown: { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)", transition: ENTER },
  exit: { opacity: 0, filter: "blur(4px)", transform: "translateY(-12px)", transition: EXIT },
} as const;

/** The same entrance without blur, for cards and rows that arrive in numbers. */
export const RISE = {
  hidden: { opacity: 0, transform: "translateY(12px)" },
  shown: { opacity: 1, transform: "translateY(0px)", transition: ENTER },
} as const;

/** Reduced motion: every entrance becomes an opacity fade (and blur goes too). */
export const FADE = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: ENTER },
  exit: { opacity: 0, transition: EXIT },
} as const;

/** A parent that releases its children one after another. */
export const stagger = (gap: number, delay = 0) => ({
  hidden: {},
  shown: { transition: { staggerChildren: gap, delayChildren: delay } },
});
