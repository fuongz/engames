import { Copy01Icon, Crown02Icon, Logout01Icon, Robot01Icon, Tick02Icon, WifiDisconnected01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GameManifest } from "@web-games/core";
import { type FormEvent, useId, useState } from "react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import type { ServerMessage } from "@web-games/core/online";

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
  onRetry: () => void;
  onLeave: () => void;
}) {
  const m = useMessages();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const max = game.online?.maxPlayers ?? 6;

  const copy = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  const me = lobby?.players.find((p) => p.id === lobby.you);
  const isHost = lobby !== null && lobby.host === lobby.you;
  const bots = Math.max(0, max - (lobby?.players.length ?? 0));

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto overscroll-contain p-5">
      <img src={game.banner} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-40 blur-2xl" />
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
            <Button variant="outline" className="h-10" onClick={copy}>
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} data-icon="inline-start" />
              {copied ? m.online.copied : m.online.invite}
            </Button>

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
              {isHost ? (
                <Button className="h-11" onClick={onStart} data-cuelume-emphasis="strong">
                  {m.online.start}
                </Button>
              ) : (
                <p className="text-center text-sm text-muted-foreground" role="status">
                  {m.online.waitingHost}
                </p>
              )}
            </div>
            {!signedIn && <p className="text-center text-xs text-muted-foreground">{m.online.signInNote}</p>}
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
