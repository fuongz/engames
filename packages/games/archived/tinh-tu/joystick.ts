/**
 * Turns a virtual-joystick drag into keyboard-like movement: still inside the
 * dead zone, otherwise full speed in one of 8 directions. Analog stick input
 * felt twitchy on phones (a few pixels changed speed and heading), and players
 * asked for it to behave like WASD on desktop.
 */

export const JOY_DEADZONE = 14; // logical px before the rider moves at all
/** Extra degrees a drag must pass a sector edge before switching, so a shaky thumb doesn't flicker. */
const HYSTERESIS = (8 * Math.PI) / 180;
const SECTOR = Math.PI / 4;

export interface JoyDirection {
  mx: number;
  my: number;
  /** 0 = right, 2 = down, 4 = left, 6 = up (screen y grows down); null when idle. */
  sector: number | null;
}

export function joystickDirection(dx: number, dy: number, previous: number | null): JoyDirection {
  if (Math.hypot(dx, dy) < JOY_DEADZONE) return { mx: 0, my: 0, sector: null };
  const angle = Math.atan2(dy, dx);
  let sector = (((Math.round(angle / SECTOR) % 8) + 8) % 8) as number;
  if (previous !== null && previous !== sector) {
    // Stay in the previous sector until we're clearly past its edge
    const centre = previous * SECTOR;
    const off = Math.abs(Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre)));
    if (off < SECTOR / 2 + HYSTERESIS) sector = previous;
  }
  const a = sector * SECTOR;
  // Same as the keyboard: unit length, so diagonals are not faster
  return { mx: round(Math.cos(a)), my: round(Math.sin(a)), sector };
}

// `|| 0` folds -0 (e.g. cos 270°) into 0
const round = (v: number) => Math.round(v * 1e6) / 1e6 || 0;
