import { Add01Icon, QrCodeIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import type { GameManifest } from "@web-games/core";
import { isRoomCode } from "@web-games/core/online";
import { findGame } from "@web-games/games";
import { type FormEvent, useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";
import { onlineMode, randomRoomCode } from "#/lib/online";
import { QrScanDialog } from "./qr-scan-dialog";

/** "Play online co-op" (or "Play a friend online") on the start screen: make a room, or join one by code. Either way the URL gets ?room=. */
export function OnlineEntry({ game }: { game: GameManifest }) {
  const m = useMessages();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const codeId = useId();
  if (!game.online) return null;
  const versus = onlineMode(game) === "versus";
  // More than two players against each other: not a 1-on-1
  const group = versus && game.online.maxPlayers > 2;
  const title = group ? m.online.versusGroup : versus ? m.online.versus : m.online.coop;

  const go = (room: string, slug = game.slug) => {
    setOpen(false);
    setScanning(false);
    void navigate({ to: "/games/$slug", params: { slug }, search: { room } });
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const room = code.trim().toUpperCase();
    if (!isRoomCode(room)) return setError(m.online.badCode);
    go(room);
  };

  return (
    <>
      <Button variant="secondary" size="lg" className="h-11 w-full max-w-60 rounded-full" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={UserGroupIcon} data-icon="inline-start" />
        {title}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{group
                ? fmt(m.online.versusGroupHint, { min: game.online.minPlayers, max: game.online.maxPlayers })
                : versus
                  ? m.online.versusHint
                  : fmt(m.online.coopHint, { max: game.online.maxPlayers })}</DialogDescription>
          </DialogHeader>
          <Button size="lg" className="h-11" onClick={() => go(randomRoomCode())}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
            {m.online.create}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{m.online.or}</p>
          <Button variant="secondary" size="lg" className="h-11" onClick={() => setScanning(true)}>
            <HugeiconsIcon icon={QrCodeIcon} data-icon="inline-start" />
            {m.online.scan}
          </Button>
          <form onSubmit={join} className="grid gap-2">
            <label htmlFor={codeId} className="text-sm font-medium">
              {m.online.codeLabel}
            </label>
            <div className="flex gap-2">
              <Input
                id={codeId}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder={m.online.codePlaceholder}
                className="h-11 font-mono tracking-[0.2em] uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
                aria-invalid={error ? true : undefined}
              />
              <Button type="submit" variant="outline" className="h-11 px-5">
                {m.online.join}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>
      <QrScanDialog
        open={scanning}
        onOpenChange={setScanning}
        slug={game.slug}
        // A QR code for another game's room opens that game
        onRoom={(room) => (findGame(room.slug) ? go(room.code, room.slug) : setError(m.online.scanNotRoom))}
      />
    </>
  );
}
