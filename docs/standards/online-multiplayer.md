# Online multiplayer standard

How a game in `packages/games` becomes playable online, and how the pieces that
carry it — the shared online layer, the realtime Worker and the portal — fit
together. Read it before adding online play to a game or touching
`apps/realtime/` or `packages/core/src/online/`.

The first online game is **Ký Túc Xá Đêm / Night Dorm** in **co-op**: up to six
people share one dorm against the Dream Hunter, and bots fill any empty bed.

---

## TL;DR

- **The server owns the game.** Clients send inputs (`move`, `actions`); a
  Durable Object runs the game's own pure `logic.ts` at 20 Hz and sends state
  back. Nobody can edit their gold or their score.
- **One Durable Object per room** (`GameRoom`, addressed by `"<slug>:<code>"`) in
  a separate Worker, **`apps/realtime`**. The portal Worker never holds a socket.
- **The portal hands out tickets.** A server function signs a 60-second HMAC
  ticket (room, player, name, signed-in or guest); the realtime Worker only
  checks the signature. Guests play in rooms by link; only signed-in players get
  onto the online leaderboard.
- **A game opts in with three files**: an `online` block in its manifest, an
  `online.ts` adapter that implements `RoomGame`, and an online branch in
  `game.ts`. The portal, the Worker and the protocol need no edits.
- **Single-player is unchanged.** Offline is the same simulation with one human
  seat and five bots.

---

## 1. The pieces

```
 Browser ─────────────────────────────────────────────────────────────────────────
   portal (React)                                   game (canvas, framework-free)
   • "Online co-op" → create / join a room           • online branch of game.ts:
   • lobby: players, invite link, ready, start         sends inputs, renders snapshots,
   • owns the RoomClient (one WebSocket)               predicts its own movement
        │  1. createOnlineTicket({ slug, code?, name? })  (TanStack server function)
        ▼
 Worker "engames" (apps/web) ──── 3. POST /api/online/results  (HMAC-signed, from the room)
   • signs tickets (TICKET_SECRET)                  • saves signed-in players' scores
        │                                              to the "<slug>:coop" board in D1
        │  2. wss://<realtime>/rooms/<slug>/<code>?ticket=…
        ▼
 Worker "engames-realtime" (apps/realtime)
   • verifies the ticket and the Origin
   • forwards the upgrade to GameRoom.getByName("<slug>:<code>")
        ▼
 Durable Object GameRoom (one per room)
   • lobby: seats, host, ready flags (kept in WebSocket attachments → can hibernate)
   • match: RoomGame from packages/games/src/online.ts, setInterval 20 Hz
   • snapshots 10 Hz + events every tick; results at the end
```

| Piece | Path | Owns |
| --- | --- | --- |
| Shared online layer | `packages/core/src/online/` | protocol types, ticket sign/verify, `RoomGame` contract, the browser `RoomClient` |
| Online registry | `packages/games/src/online.ts` | which games are playable online (`onlineGames`, `findOnlineGame`) |
| A game's adapter | `packages/games/src/<slug>/online.ts` | maps the game's `logic.ts` onto `RoomGame` |
| Realtime Worker | `apps/realtime/` | ticket check, `GameRoom` Durable Object, posting results |
| Portal | `apps/web/src/server/online.ts` (+ `server/online/`), `routes/api/online/results.ts`, `components/features/online/`, `lib/online.ts` | tickets, saving results, lobby UI, the realtime URL |

Everything in `packages/core/src/online/` except `client.ts` is **pure**: no DOM,
no Worker APIs beyond Web Crypto, so it runs in the browser, in `workerd` and in
`vitest` alike. It is exported as `@web-games/core/online`; the browser client as
`@web-games/core/online/client`, so the Worker never bundles DOM code. The
registry of online games is `@web-games/games/online` — core never names a game.

`packages/games/src/conventions.test.ts` enforces this for every game's `logic.ts`,
`config.ts`, `strings.ts` and `online.ts`: besides their own folder they may import
only `@web-games/core/math`, `@web-games/core/i18n` and `@web-games/core/online` —
never the `@web-games/core` root, which pulls in the canvas runtime.

### Inside each piece

| File | Role |
| --- | --- |
| `packages/core/src/online/protocol.ts` | message types, `parseClientMessage`, room codes, `boardKey`, limits |
| `packages/core/src/online/ticket.ts` | `signTicket` / `verifyTicket`, `hmac` / `verifyHmac` |
| `packages/core/src/online/room-game.ts` | the `RoomGame` / `RoomSim` contract |
| `packages/games/src/online.ts` | `onlineGames`, `findOnlineGame` |
| `packages/core/src/online/client.ts` | `RoomClient`: one socket, ping/RTT, events |
| `packages/core/src/net.ts` | `InputLog` (prediction replay), `approach` (easing) |
| `apps/realtime/src/index.ts` | Worker entry: Origin + ticket check, forward to the room |
| `apps/realtime/src/game-room.ts` | the Durable Object: sockets, hibernation, timer, result posts |
| `apps/realtime/src/room-core.ts` | the room's rules, DO-free (tested in `room-core.test.ts`) |
| `apps/web/src/components/features/online/online-entry.tsx` | "Online co-op" button + create/join dialog |
| `apps/web/src/components/features/online/online-session.tsx` | the room hook (ticket, socket, reconnect) and the `OnlineMatch` handed to the game |
| `apps/web/src/components/features/online/lobby.tsx` | the lobby screen |
| `apps/web/src/components/features/game-player/board-tabs.tsx` | Solo / Co-op leaderboard tabs |

---

## 2. Why these choices

| Decision | Chosen | Why |
| --- | --- | --- |
| Authority | Server-authoritative, inputs only from clients | Cheating means editing a number the server never accepts. The rules live in one file |
| Simulation | The game's own `logic.ts`, unmodified on the server | It is pure by rule (`conventions.test.ts`), so `workerd` runs it as is |
| Infrastructure | Durable Objects + WebSockets | One object is one room: a single thread, strongly consistent, next to its players |
| Where the DO lives | Its own Worker, `apps/realtime` | `apps/web` runs TanStack Start's stock server entry; a DO there needs a custom entry. Apart, the game server deploys without redeploying the site and keeps its own DO migrations |
| Tick | `setInterval` at 50 ms **only while a match runs** | Timers keep the object awake, which a 3–5 minute match wants anyway. Alarms are for coarse work (room expiry), not a 20 Hz loop |
| Sockets | `ctx.acceptWebSocket()` (Hibernation API) | A lobby or a finished room hibernates without dropping anyone and without duration charges. Ping/pong is answered by the runtime |
| Auth | Portal-signed HMAC ticket | The realtime Worker never talks to Better Auth. Guests are first-class players |
| Wire format | JSON | The whole Night Dorm state is a few KB. Deltas or binary are a later optimisation |
| Results | Room → portal over HTTP with an HMAC signature | The portal keeps sole ownership of the D1 schema and the leaderboard code |

---

## 3. Lifecycle of a room

1. **Create.** The player picks *Online co-op → Create room*. The portal draws a
   6-character code (`A–Z`, `2–9`, no look-alikes), calls
   `createOnlineTicket({ slug, code })` and opens the socket. The first player in
   is the **host**.
2. **Invite.** The URL is `/games/<slug>?room=<code>`. Anyone opening it is asked
   for a name if they are a guest, gets a ticket and joins the lobby.
3. **Lobby.** Everyone sees the seats (humans, then *Bot* placeholders), toggles
   **Ready**, and the host presses **Start** (one human is enough; bots fill the
   rest). Seats beyond `maxPlayers` are refused with `room-full`.
4. **Match.** The room creates the simulation with a fresh seed and the seated
   humans, sends `start` (seed, seats, each client's own seat), and ticks.
5. **Drop and rejoin.** A socket that closes mid-match puts that seat on
   **autopilot** (it keeps buying for its room like a bot; it does not walk, so a
   player who drops before reaching a bed is caught at nightfall). The browser
   retries with a fresh ticket (1, 2, 4, 8, 8 s); the same player id takes the
   seat back and receives `start` plus the current snapshot. Someone who arrives
   mid-match gets `start` with `you: -1` and watches until the next one.
6. **End.** The room sends `end` with every human's result, posts the signed-in
   players' scores to the portal, stops the tick and returns to the lobby state.
   Each client stays on its result card (team scores) until the player presses
   **Back to lobby**; a match abandoned without `end` (everyone gone for 30 s)
   drops clients to the lobby at once.
7. **Expire.** An empty room is forgotten: nothing is persisted beyond the
   sockets' attachments, so a room with no sockets has no state.

---

## 4. Protocol

All messages are JSON objects with a `t` field. Types live in
`packages/core/src/online/protocol.ts`; never hand-write a message shape
elsewhere.

### Client → server

| `t` | Fields | When |
| --- | --- | --- |
| `ready` | `ready: boolean` | Lobby toggle |
| `start` | — | Host only, lobby only |
| `in` | `seq: number`, `move: {x, y}`, `actions: unknown[]` | Every input tick (20 Hz) while moving or with actions; nothing when idle |
| `again` | — | After `end`: back to the lobby (any player) |
| `ping` | `at: number` | Every 5 s, for the latency readout |

### Server → client

| `t` | Fields | When |
| --- | --- | --- |
| `lobby` | `code, slug, status, host, you, players[], maxPlayers` | On join and on every lobby change |
| `start` | `seed, tickRate, you: seat, seats[]` | Match begins, or on rejoin mid-match |
| `snap` | `tick, state, acks: Record<seat, seq>` | Every 2nd tick (10 Hz) |
| `ev` | `tick, events[]` | Every tick that produced events (sound, effects) |
| `end` | `results[]` | Match over |
| `pong` | `at` | Reply to `ping` |
| `error` | `code` | `bad-ticket`, `room-full`, `not-host`, `in-progress`, `bad-message` |

### Inputs and prediction

- The client runs a fixed **20 Hz input clock**. Each input carries a rising
  `seq`. The room queues at most 4 inputs per seat and applies **one per tick**
  (no input that tick = standing still), so the client and the server advance
  movement in identical 1/20 s steps.
- **Own avatar:** the client applies each input locally with the game's movement
  function. On every `snap` it resets to the server's position and re-applies the
  inputs after `acks[you]`. Bumps against walls agree because both sides run the
  same code.
- **Everyone else and the hunter:** eased toward the latest snapshot
  (`1 - exp(-dt·15)`), enough for a game this slow.

---

## 5. The `RoomGame` contract

`packages/core/src/online/room-game.ts`:

```ts
export interface RoomGame<Input = unknown> {
  slug: string;
  minPlayers: number;
  maxPlayers: number;
  /** Simulation steps per second; snapshots go out at half this rate. */
  tickRate: number;
  create(seed: number, humans: { name: string }[]): RoomSim<Input>;
  /** Untrusted input from a socket → a valid Input, or null to drop it. */
  parseInput(raw: unknown): Input | null;
}

export interface RoomSim<Input> {
  /** One step of 1/tickRate s with one input (or none) per human seat. */
  step(inputs: (Input | null)[]): void;
  setAutopilot(seat: number, on: boolean): void;
  snapshot(): unknown;          // JSON-safe
  drainEvents(): unknown[];     // JSON-safe, cleared on read
  readonly over: boolean;
  results(): { seat: number; score: number; detail: string }[];
}
```

Rules:

- `parseInput` is the only door for socket data into the simulation. Clamp
  vectors, whitelist action types, reject everything else.
- `snapshot()` must be **JSON-safe and complete** for rendering: the client
  rebuilds its view from it alone.
- Results are computed by the simulation, never by a client.

The registry, `packages/games/src/online.ts`, is an explicit map
(`{ "ky-tuc-xa": kyTucXaOnline }`): the realtime Worker is bundled by Wrangler,
which has no `import.meta.glob`. A test checks that every manifest with an
`online` block has a registry entry and vice versa.

---

## 6. Making a game online

1. **Make the simulation multi-seat.** `createGame(seed, humans)` seats each
   human and fills the rest with bots; `update(s, dt, inputs)` takes inputs keyed
   by seat. The random state must be a number inside the state (`seed`), not a
   closure, so a snapshot is plain data. Offline stays "one human seat".
2. **Write `<slug>/online.ts`** implementing `RoomGame`, and add it to
   `online/registry.ts`.
3. **Declare it** in the manifest: `online: { modes: ["coop"], minPlayers, maxPlayers }`. That alone makes
   the portal mark it: the **Co-op badge** (`components/shared/games/coop-badge.tsx`)
   on cards, the hero and the details, the **Online co-op** filter in the library
   (`/library?coop=1`, also a sidebar item), "co-op"/"online" in search, and the
   *Play online co-op* button on its start screen.
4. **Add the online branch to `game.ts`.** When `rt.game.online` is set, do not
   step the simulation: send inputs through `online.send`, rebuild the view from
   snapshots, play events from `ev`, and show `end` results. Never call
   `reportScore` online — the room saves scores itself.
5. **Test the simulation with several seats** in `logic.test.ts`, and the
   adapter in `online.test.ts` (parse rejects garbage, a full match ends, results
   are per seat).

---

## 7. Night Dorm co-op rules

| Rule | Solo | Co-op |
| --- | --- | --- |
| Seats | 1 human + 5 bots | up to 6 humans, bots fill the rest |
| Hunter's first target | never you | never a human |
| Not in bed when night falls | caught → game over | that player is caught and spectates |
| Your door breaks | game over | you are out and spectate; the team plays on |
| Match ends | hunter down, or you are out | hunter down (**everyone wins**), or every human is out |
| Score | your gold earned + 5/s survived + hunter bonus | the same per player; survival counts until *your* door fell; the hunter bonus goes to every human |
| Disconnect | — | autopilot buys for your room until you return |

Online scores go to the board `ky-tuc-xa:coop` (see §9), separate from solo.

---

## 8. Security

- **Tickets** are `base64url(payload).base64url(HMAC-SHA256(payload, TICKET_SECRET))`
  with `{ r: room, s: slug, p: playerId, n: name, u: userId|null, e: expiry }`.
  60-second expiry; they authorise the *join*, after which the socket is the
  session.
- **Player ids**: signed-in players use their user id; guests use a random id kept
  in `localStorage` (`engames:portal:guestId`), so a refresh rejoins the same seat.
  The id is inside the signed ticket, so nobody can claim another's seat.
- **Origin check**: the realtime Worker rejects upgrades whose `Origin` is not in
  `ALLOWED_ORIGINS`.
- **Untrusted input**: every socket message is size-capped (4 KB), parsed with a
  type check, and inputs go through `parseInput`. A socket that sends more than
  60 messages per second is closed.
- **Results** are posted with an `x-signature` HMAC of the body; the portal route
  rejects anything unsigned or stale (`at` older than 60 s). The room posts to
  `PORTAL_URL` over HTTPS; if same-zone Worker-to-Worker fetches are ever refused,
  switch to a service binding (`services: [{ binding: "WEB", service: "engames" }]`).

---

## 9. Leaderboard

Online results use the existing `score` table with a **board key** in
`game_slug`: `"<slug>:<mode>"` (e.g. `ky-tuc-xa:coop`). Solo keeps the bare slug.
No migration is needed and the best-per-player rule keeps working per board.
Only signed-in players are saved; guests see their result in the match but not
on the board. `boardKey(slug, mode)` in `packages/core/src/online/protocol.ts`
is the one place that builds the key.

---

## 10. Running it

### Local

```sh
bun install
# Both workers need the same secret: put TICKET_SECRET=<anything long> in
#   apps/web/.dev.vars  and  apps/realtime/.dev.vars
bun run dev            # portal on http://localhost:5173
bun run dev:realtime   # realtime on ws://localhost:8787
```

`apps/realtime/.dev.vars` also sets `ALLOWED_ORIGINS=http://localhost:5173` and
`PORTAL_URL=http://localhost:5173` (see `.dev.vars.example`).

The portal reads the realtime URL from `VITE_REALTIME_URL` (defaults to
`ws://localhost:8787` in dev). Open two browser profiles to play together.

### Production (one-time)

```sh
openssl rand -base64 32 | tee /dev/stderr | (cd apps/web && bunx wrangler secret put TICKET_SECRET)
# paste the same value:
cd apps/realtime && bunx wrangler secret put TICKET_SECRET
bun run deploy:realtime   # creates the Worker, the DO class and its custom domain
bun run deploy            # the portal, built with VITE_REALTIME_URL=wss://engames-rt.trinhvaphuong.com
```

---

## 11. Costs and limits

- A 5-minute, 6-player match keeps one object awake ≈ **37.5 GB-s** and sends
  ≈ 36 000 inputs (billed 20:1 ≈ 1 800 requests). Outgoing messages are free.
  On Workers Paid the included 400 000 GB-s cover ≈ 10 000 matches a month;
  past that a match costs ≈ $0.001.
- A room lives in one data centre, chosen near whoever opened it. Players far
  from the host feel more latency; Night Dorm tolerates 150 ms comfortably.
- **A room that is evicted or crashes mid-match loses the match.** State is in
  memory during play by design. If that becomes a problem, checkpoint
  `snapshot()` to the object's SQLite every few seconds — the state is already
  plain data.

---

## 12. Not built yet

- **Quick play** (a `Matchmaker` object that hands out open rooms). Rooms are by
  link only for now.
- **Competitive Night Dorm** (racing for rooms, stripping dark rooms).
- **Daily challenge** for the solo games (shared seed, replay-verified scores).
- Delta or binary snapshots.
