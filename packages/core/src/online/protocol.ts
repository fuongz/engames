// The wire protocol between a browser and a GameRoom. Every message is a JSON
// object with a `t` field; these types are the only definition of the shapes.
// Pure: imported by the browser, the realtime Worker and the portal server.

export type OnlineMode = "coop";

/** Room codes: 6 characters with no look-alikes (no 0/O, 1/I/L). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const isRoomCode = (s: string) =>
  s.length === CODE_LENGTH && [...s].every((c) => CODE_ALPHABET.includes(c));

/** Leaderboard key in `score.game_slug`: the bare slug for solo, "<slug>:<mode>" online. */
export const boardKey = (slug: string, mode?: OnlineMode) => (mode ? `${slug}:${mode}` : slug);

/** Socket messages larger than this are dropped unread. */
export const MAX_MESSAGE_BYTES = 4096;
/** A socket sending more than this per second is closed. */
export const MAX_MESSAGES_PER_SECOND = 60;
/** Inputs a seat may have queued; older ones are dropped. */
export const INPUT_QUEUE = 4;

export interface Vec {
  x: number;
  y: number;
}

// ---------------------------------------------------------------- client → server

export type ClientMessage =
  | { t: "ready"; ready: boolean }
  | { t: "start" }
  | { t: "in"; seq: number; move: Vec; actions: unknown[] }
  | { t: "again" }
  | { t: "ping"; at: number };

// ---------------------------------------------------------------- server → client

export type RoomStatus = "lobby" | "playing";

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  /** Signed in (their score can reach the online board). */
  member: boolean;
  /** Their seat in the current match, if one is running. */
  seat: number | null;
}

export interface SeatInfo {
  seat: number;
  name: string;
}

export interface SeatResult {
  seat: number;
  name: string;
  score: number;
  detail: string;
}

export type ErrorCode = "bad-ticket" | "room-full" | "not-host" | "in-progress" | "bad-message" | "unknown-game";

export type ServerMessage =
  | {
      t: "lobby";
      code: string;
      slug: string;
      status: RoomStatus;
      host: string | null;
      you: string;
      players: LobbyPlayer[];
      maxPlayers: number;
    }
  | { t: "start"; seed: number; tickRate: number; you: number; seats: SeatInfo[] }
  | { t: "snap"; tick: number; state: unknown; acks: Record<number, number> }
  | { t: "ev"; tick: number; events: unknown[] }
  | { t: "end"; results: SeatResult[] }
  | { t: "pong"; at: number }
  | { t: "error"; code: ErrorCode };

// ---------------------------------------------------------------- parsing

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Untrusted socket text → a well-formed ClientMessage, or null. Inputs are still checked by the game's parseInput. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(m)) return null;
  switch (m.t) {
    case "ready":
      return typeof m.ready === "boolean" ? { t: "ready", ready: m.ready } : null;
    case "start":
    case "again":
      return { t: m.t };
    case "ping":
      return finite(m.at) ? { t: "ping", at: m.at } : null;
    case "in": {
      const move = m.move;
      if (!finite(m.seq) || !isObj(move) || !finite(move.x) || !finite(move.y) || !Array.isArray(m.actions)) return null;
      return { t: "in", seq: m.seq, move: { x: move.x, y: move.y }, actions: m.actions.slice(0, 8) };
    }
    default:
      return null;
  }
}
