import { audioBus, type GameManifest, type OnlineMatch } from "@web-games/core";
import type { ServerMessage } from "@web-games/core/online";
import { RoomClient } from "@web-games/core/online/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "#/hooks/use-session";
import { roomSocketUrl } from "#/lib/online";
import { createOnlineTicket } from "#/server/online";
import { Lobby, type LobbyState, type RoomPhase } from "./lobby";

const GUEST_ID_KEY = "engames:portal:guestId";
/** Shared with the score dialog: the name a guest typed last. */
const NAME_KEY = "engames:portal:playerName";
const RETRY_MS = [1000, 2000, 4000, 8000, 8000];

/** The random id a guest browser keeps, so a refresh rejoins the same seat. */
function guestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

type MatchStart = Extract<ServerMessage, { t: "start" }>;

/**
 * One room socket for the life of the game page: gets a ticket, connects,
 * reconnects with backoff (a fresh ticket each time) and exposes the lobby and
 * the current match. The game itself reads the same socket via `client`.
 */
function useRoom(slug: string, code: string, name: string | null, signedIn: boolean) {
  const [phase, setPhase] = useState<RoomPhase>("connecting");
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [match, setMatch] = useState<MatchStart | null>(null);
  const [rtt, setRtt] = useState(0);
  const [attemptKey, setAttemptKey] = useState(0);
  const clientRef = useRef<RoomClient | null>(null);
  /** The current match sent its results: keep showing them until the player leaves the card. */
  const endedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attemptKey re-runs the connection for "Try again"
  useEffect(() => {
    if (!signedIn && !name) {
      setPhase("needs-name");
      return;
    }
    let alive = true;
    let attempt = 0;
    let retry = 0;
    let off = () => {};

    const connect = async () => {
      setPhase(attempt === 0 ? "connecting" : "reconnecting");
      let ticket: string;
      try {
        ({ ticket } = await createOnlineTicket({ data: { slug, code, ...(signedIn ? {} : { name: name ?? "", guestId: guestId() }) } }));
      } catch {
        return scheduleRetry();
      }
      if (!alive) return;
      const client = new RoomClient(roomSocketUrl(slug, code, ticket));
      clientRef.current = client;
      off = client.on((e) => {
        if (e.t === "open") {
          attempt = 0;
          setPhase("open");
        } else if (e.t === "lobby") {
          setLobby(e);
          // A match that ended without results (abandoned) leaves at once; a finished
          // one stays on its result card until "Back to lobby"
          if (e.status === "lobby" && !endedRef.current) setMatch(null);
        } else if (e.t === "end") endedRef.current = true;
        else if (e.t === "start") {
          endedRef.current = false;
          setMatch(e);
        }
        else if (e.t === "pong") setRtt(client.rtt);
        else if (e.t === "error" && e.code === "room-full") setPhase("full");
        else if (e.t === "closed") {
          off();
          if (!alive || e.code === 1000 || e.code === 4003) return;
          // 4000: this player opened the room elsewhere; don't fight over the seat
          if (e.code === 4000) return setPhase("failed");
          scheduleRetry();
        }
      });
      client.connect();
    };

    const scheduleRetry = () => {
      if (!alive) return;
      if (attempt >= RETRY_MS.length) return setPhase("failed");
      setPhase("reconnecting");
      retry = window.setTimeout(connect, RETRY_MS[attempt++]);
    };

    void connect();
    return () => {
      alive = false;
      window.clearTimeout(retry);
      off();
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [slug, code, name, signedIn, attemptKey]);

  const send = useCallback((m: Parameters<RoomClient["send"]>[0]) => clientRef.current?.send(m), []);
  const endMatch = useCallback(() => setMatch(null), []);
  const retry = useCallback(() => setAttemptKey((k) => k + 1), []);

  return {
    phase,
    lobby,
    match,
    rtt,
    client: clientRef,
    send,
    /** Back to the lobby screen after a match's result card. */
    endMatch,
    /** After "failed": start over with a fresh ticket. */
    retry,
  };
}

/**
 * An online room on the game page: the lobby while waiting, and an
 * OnlineMatch for the game when a match starts (the parent mounts it).
 */
export function OnlineSession({
  game,
  code,
  onMatch,
  onLeave,
}: {
  game: GameManifest;
  code: string;
  onMatch: (match: OnlineMatch | null) => void;
  onLeave: () => void;
}) {
  const session = useSession();
  const signedIn = Boolean(session.data?.user);
  const [name, setName] = useState<string | null>(() => localStorage.getItem(NAME_KEY));
  // Wait for the session: a signed-in player must not be asked for a guest name
  const room = useRoom(game.slug, code, session.isPending ? null : name, signedIn);
  const phase = session.isPending ? "connecting" : room.phase;

  const { match, client, endMatch, send } = room;
  useEffect(() => {
    const socket = client.current;
    if (!match || !socket) return onMatch(null);
    onMatch({
      seat: match.you,
      seats: match.seats,
      seed: match.seed,
      tickRate: match.tickRate,
      send: (input) => socket.send({ t: "in", ...input }),
      onMessage: (fn) =>
        socket.on((e) => {
          if (e.t === "snap" || e.t === "ev" || e.t === "end") fn(e);
        }),
      backToLobby: () => {
        endMatch();
        send({ t: "again" });
      },
    });
    // onMatch/endMatch are stable for the life of a match; only a new start remounts
  }, [match, client, endMatch, send, onMatch]);

  if (match) return null;
  return (
    <Lobby
      game={game}
      code={code}
      phase={phase}
      lobby={room.lobby}
      rtt={room.rtt}
      signedIn={signedIn}
      onName={(n) => {
        audioBus.unlock();
        localStorage.setItem(NAME_KEY, n);
        setName(n);
      }}
      onReady={(ready) => {
        // Every lobby tap is the gesture browsers need before the match can make sound
        audioBus.unlock();
        send({ t: "ready", ready });
      }}
      onStart={() => {
        audioBus.unlock();
        send({ t: "start" });
      }}
      onRetry={room.retry}
      onLeave={onLeave}
    />
  );
}
