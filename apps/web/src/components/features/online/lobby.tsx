import {
  Copy01Icon,
  Crown02Icon,
  Logout01Icon,
  QrCodeIcon,
  Robot01Icon,
  Tick02Icon,
  WifiDisconnected01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GameManifest } from "@web-games/core";
import { type FormEvent, useId, useState } from "react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useHistoryConsent } from "#/hooks/use-history-consent";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";
import { inviteUrl, onlineMode } from "#/lib/online";
import { cn } from "#/lib/utils";
import type { ServerMessage } from "@web-games/core/online";
import { RoomQr } from "./room-qr";

export type RoomPhase = "connecting" | "reconnecting" | "open" | "full" | "failed" | "needs-name";
export type LobbyState = Extract<ServerMessage, { t: "lobby" }>;

/** The room screen over the game area: who is here, the invite link, ready and start. */
export function Lobby({
  game,
  code,
  phase,
  lobby,
  rtt,
  signedIn,
  onName,
  onReady,
  onStart,
  onSettings,
  onRetry,
  onLeave,
}: {
  game: GameManifest;
  code: string;
  phase: RoomPhase;
  lobby: LobbyState | null;
  rtt: number;
  signedIn: boolean;
  onName: (name: string) => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  /** Host only: change a lobby setting (e.g. Caro's best-of). */
  onSettings: (settings: Record<string, string>) => void;
  onRetry: () => void;
  onLeave: () => void;
}) {
  const m = useMessages();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const history = useHistoryConsent();
  const max = game.online?.maxPlayers ?? 6;
  const link = typeof window === "undefined" ? "" : inviteUrl(window.location.origin, game.slug, code);

  const copy = () => {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  const me = lobby?.players.find((p) => p.id === lobby.you);
  const isHost = lobby !== null && lobby.host === lobby.you;
  const versus = onlineMode(game) === "versus";
  // Versus rooms have no bots unless the game says so: the match waits for enough connected humans
  const fills = !versus || game.online?.bots === true;
  // A "players" setting (Ludo, Tycoon) is the table size the host picked; bots fill up to it
  const seats = Number(lobby?.settings?.players) || max;
  const bots = fills ? Math.max(0, seats - (lobby?.players.length ?? 0)) : 0;
  const short = versus && (lobby?.players.filter((p) => p.connected).length ?? 0) < (game.online?.minPlayers ?? 1);

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto overscroll-contain p-5">
      <img src={game.banner} alt={game.title[locale]} aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-2xl" />
      <div className="relative grid w-full max-w-sm gap-4 rounded-3xl bg-background/80 p-5 ring-1 ring-white/10 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <p className="text-xs font-medium text-muted-foreground">{game.title[locale]}</p>
            <h2 className="font-mono text-2xl font-bold tracking-[0.15em]">{code}</h2>
          </div>
          {phase === "open" && rtt > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {fmt(m.online.ping, { ms: rtt })}
            </Badge>
          )}
        </div>

        {phase === "needs-name" ? (
          <NameForm onName={onName} />
        ) : phase === "full" || phase === "failed" ? (
          <div className="grid gap-3">
            <p className="text-sm text-destructive">{phase === "full" ? m.online.roomFull : m.online.failed}</p>
            {phase === "failed" && (
              <Button variant="secondary" className="h-11" onClick={onRetry}>
                {m.online.retry}
              </Button>
            )}
          </div>
        ) : !lobby || phase !== "open" ? (
          <p className="py-6 text-center text-sm text-muted-foreground" role="status">
            {phase === "reconnecting" ? m.online.reconnecting : m.online.connecting}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button variant="outline" className="h-10" onClick={copy}>
                <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} data-icon="inline-start" />
                {copied ? m.online.copied : m.online.invite}
              </Button>
              <Button
                variant={showQr ? "secondary" : "outline"}
                size="icon"
                className="size-10"
                aria-label={showQr ? m.online.hideQr : m.online.showQr}
                aria-expanded={showQr}
                onClick={() => setShowQr((v) => !v)}
              >
                <HugeiconsIcon icon={QrCodeIcon} />
              </Button>
            </div>
            {showQr && (
              <figure className="grid justify-items-center gap-2">
                <RoomQr url={link} label={m.online.qrTitle} className="size-48 overflow-hidden rounded-2xl p-1" />
                <figcaption className="text-center text-xs text-muted-foreground">{m.online.qrHint}</figcaption>
              </figure>
            )}

            {(game.online?.settings ?? []).map((s) => (
              <div key={s.key} className="grid gap-2">
                <p className="flex items-baseline justify-between text-sm font-semibold">
                  {s.label[locale]}
                  {!isHost && <span className="text-xs font-normal text-muted-foreground">{m.online.settingsHostOnly}</span>}
                </p>
                <ToggleGroup
                  value={[lobby.settings?.[s.key] ?? s.default]}
                  onValueChange={(v) => v[0] && onSettings({ [s.key]: v[0] })}
                  aria-label={s.label[locale]}
                  variant="outline"
                  disabled={!isHost}
                  className="w-full"
                >
                  {s.choices.map((c) => (
                    <ToggleGroupItem key={c.value} value={c.value} className="h-10 flex-1 aria-pressed:border-primary/60 aria-pressed:bg-primary/15 aria-pressed:text-primary">
                      {c.label[locale]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}

            {history.value === null && (
              <section className="grid gap-2 rounded-2xl bg-muted/60 p-3" aria-labelledby="history-ask">
                <p id="history-ask" className="text-sm font-semibold">
                  {m.online.historyAsk}
                </p>
                <p className="text-xs text-muted-foreground">{m.online.historyAskHint}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" className="h-9" onClick={() => void history.set(false)}>
                    {m.online.historyNo}
                  </Button>
                  <Button variant="secondary" className="h-9" onClick={() => void history.set(true)}>
                    {m.online.historyYes}
                  </Button>
                </div>
              </section>
            )}

            <div className="grid gap-2">
              <p className="text-sm font-semibold">{fmt(m.online.players, { n: lobby.players.length, max })}</p>
              <ul className="grid gap-1.5">
                {lobby.players.map((p) => (
                  <li key={p.id} className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2", p.id === lobby.you ? "bg-primary/12" : "bg-muted/50")}>
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs font-semibold">{p.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {p.name}
                        {p.id === lobby.host && <HugeiconsIcon icon={Crown02Icon} className="size-4 shrink-0 text-highlight" aria-label={m.online.host} />}
                      </span>
                      <span className="text-xs text-muted-foreground">{p.id === lobby.you ? m.online.you : p.id === lobby.host ? m.online.host : " "}</span>
                    </span>
                    {!p.connected ? (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <HugeiconsIcon icon={WifiDisconnected01Icon} className="size-3.5" />
                        {m.online.away}
                      </Badge>
                    ) : p.ready ? (
                      <Badge className="gap-1">
                        <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                        {m.online.ready}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{m.online.notReady}</Badge>
                    )}
                  </li>
                ))}
              </ul>
              {bots > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Robot01Icon} className="size-4" />
                  {fmt(m.online.botsFill, { n: bots })}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Button variant={me?.ready ? "secondary" : "outline"} className="h-11" onClick={() => onReady(!me?.ready)}>
                {me?.ready ? m.online.unsetReady : m.online.setReady}
              </Button>
              {short ? (
                <p className="text-center text-sm text-muted-foreground" role="status">
                  {m.online.waitingOpponent}
                </p>
              ) : isHost ? (
                <Button className="h-11" onClick={onStart} data-cuelume-emphasis="strong">
                  {m.online.start}
                </Button>
              ) : (
                <p className="text-center text-sm text-muted-foreground" role="status">
                  {m.online.waitingHost}
                </p>
              )}
            </div>
            {!signedIn && <p className="text-center text-xs text-muted-foreground">{versus ? m.online.signInNoteVersus : m.online.signInNote}</p>}
          </>
        )}

        <Button variant="ghost" className="h-10" onClick={onLeave}>
          <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" />
          {m.online.leave}
        </Button>
      </div>
    </div>
  );
}

function NameForm({ onName }: { onName: (name: string) => void }) {
  const m = useMessages();
  const [name, setName] = useState(() => localStorage.getItem("engames:portal:playerName") ?? "");
  const [error, setError] = useState(false);
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.replace(/\s+/g, " ").trim();
    if (clean.length < 2 || clean.length > 20) return setError(true);
    onName(clean);
  };
  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {m.online.nameLabel}
      </label>
      <Input
        id={id}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(false);
        }}
        maxLength={20}
        autoFocus
        placeholder={m.online.namePlaceholder}
        className="h-11"
        aria-invalid={error ? true : undefined}
      />
      {error && <p className="text-sm text-destructive">{m.online.nameTooShort}</p>}
      <Button type="submit" className="h-11">
        {m.online.join}
      </Button>
    </form>
  );
}
