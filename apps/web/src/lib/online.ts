import { CODE_ALPHABET, CODE_LENGTH } from "@web-games/games/online";

// Where online rooms live. Override with VITE_REALTIME_URL; otherwise the local
// realtime Worker in dev and the production one in a build.
export const REALTIME_URL: string =
  import.meta.env.VITE_REALTIME_URL ?? (import.meta.env.DEV ? "ws://localhost:8787" : "wss://engames-rt.trinhvaphuong.com");

export const roomSocketUrl = (slug: string, code: string, ticket: string) =>
  `${REALTIME_URL}/rooms/${slug}/${code}?ticket=${encodeURIComponent(ticket)}`;

/** A fresh room code; any well-formed code opens (or joins) that room. */
export function randomRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
