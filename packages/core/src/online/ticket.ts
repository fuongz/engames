// Join tickets: the portal signs who may take a seat in which room; the
// realtime Worker checks the signature and expiry, nothing else. HMAC-SHA256
// over Web Crypto, so the same code runs in both Workers and in tests.

export interface TicketClaims {
  /** Room code. */
  r: string;
  /** Game slug. */
  s: string;
  /** Player id: the user id when signed in, else a guest id. */
  p: string;
  /** Display name. */
  n: string;
  /** User id when signed in (their result can reach the online board). */
  u: string | null;
  /** Expiry, unix ms. */
  e: number;
}

/** How long a ticket stays valid: it authorises the join, then the socket is the session. */
export const TICKET_TTL_MS = 60_000;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const key = (secret: string) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** HMAC of `body` as base64url; also used to sign result posts. */
export async function hmac(secret: string, body: string) {
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body))));
}

/** Constant-time check of an HMAC signature. */
export async function verifyHmac(secret: string, body: string, signature: string) {
  try {
    return await crypto.subtle.verify("HMAC", await key(secret), unb64url(signature), enc.encode(body));
  } catch {
    return false;
  }
}

export async function signTicket(secret: string, claims: TicketClaims) {
  const payload = b64url(enc.encode(JSON.stringify(claims)));
  return `${payload}.${await hmac(secret, payload)}`;
}

/** The claims of a valid, unexpired ticket, or null. */
export async function verifyTicket(secret: string, ticket: string, now = Date.now()): Promise<TicketClaims | null> {
  const [payload, sig] = ticket.split(".");
  if (!payload || !sig || !(await verifyHmac(secret, payload, sig))) return null;
  try {
    const c = JSON.parse(new TextDecoder().decode(unb64url(payload))) as TicketClaims;
    if (typeof c.e !== "number" || c.e < now) return null;
    if (typeof c.r !== "string" || typeof c.s !== "string" || typeof c.p !== "string" || typeof c.n !== "string") return null;
    return c;
  } catch {
    return null;
  }
}
