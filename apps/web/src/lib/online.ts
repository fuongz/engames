import type { GameManifest } from "@web-games/core";
import { CODE_ALPHABET, CODE_LENGTH, type OnlineMode, isRoomCode } from "@web-games/core/online";

/** How a game plays online; its board is "<slug>:<mode>". */
export const onlineMode = (game: GameManifest): OnlineMode => game.online?.modes[0] ?? "coop";

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

/** The link a friend opens (or scans) to join `code`. */
export const inviteUrl = (origin: string, slug: string, code: string) => `${origin}/games/${slug}?room=${code}`;

/**
 * What a scanned QR code points at: an invite link (`…/games/<slug>?room=<code>`,
 * on any host, so a link made on another deployment still works here), or a bare
 * room code for the game being joined. Null for anything else.
 */
export function roomFromQr(text: string, fallbackSlug: string): { slug: string; code: string } | null {
  const raw = text.trim();
  const bare = raw.toUpperCase();
  if (isRoomCode(bare)) return { slug: fallbackSlug, code: bare };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const slug = url.pathname.match(/^\/games\/([a-z0-9-]{1,40})\/?$/)?.[1];
  const code = url.searchParams.get("room")?.toUpperCase() ?? "";
  return slug && isRoomCode(code) ? { slug, code } : null;
}
