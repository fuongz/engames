import { env } from "cloudflare:workers";
import { CODE_ALPHABET, CODE_LENGTH, TICKET_TTL_MS, signTicket } from "@web-games/games/online";

// SERVER-ONLY: reads TICKET_SECRET. Behind server/online.ts.

export function newRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export interface Seat {
  slug: string;
  code: string;
  /** User id when signed in, else `guest:<id>`. */
  playerId: string;
  name: string;
  userId: string | null;
}

export function issueTicket(seat: Seat) {
  return signTicket(env.TICKET_SECRET, {
    r: seat.code,
    s: seat.slug,
    p: seat.playerId,
    n: seat.name,
    u: seat.userId,
    e: Date.now() + TICKET_TTL_MS,
  });
}
