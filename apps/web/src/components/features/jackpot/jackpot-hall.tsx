import { Ticket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { findGame } from "@web-games/games";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { Progress } from "#/components/ui/progress";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { timeAgo } from "#/lib/format";
import { fmt, intlTag } from "#/lib/i18n";
import { useJackpot } from "#/stores/jackpot";

/**
 * The Lucky Jar Hall, "Đại sảnh Hũ may mắn" (docs/standards/jackpot.md): the
 * pool now, how full it is, and the last 20 winners. Opened from the ticker;
 * public, so it works signed out. Re-reads the jar when it opens.
 */
export function JackpotHall({ onClose }: { onClose: () => void }) {
  const m = useMessages();
  const locale = useLocale();
  const state = useJackpot((s) => s.state);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(state ? "ready" : "loading");

  const load = () => {
    if (!useJackpot.getState().state) setStatus("loading");
    void useJackpot
      .getState()
      .refresh()
      .then((s) => setStatus(s ? "ready" : "error"));
  };
  // Once, on open: fresh numbers for the hall
  useEffect(load, []);

  const nf = new Intl.NumberFormat(intlTag(locale));
  const now = Date.now();
  const pct = state ? Math.min(100, Math.floor((state.pool / state.cap) * 100)) : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>{m.jackpot.hall.title}</DialogTitle>
          <DialogDescription className="text-pretty">{m.jackpot.hall.description}</DialogDescription>
        </DialogHeader>

        {status === "error" && !state ? (
          <div className="grid justify-items-start gap-3">
            <p role="alert" className="text-sm text-muted-foreground">
              {m.jackpot.hall.loadError}
            </p>
            <Button variant="secondary" className="h-10" onClick={load}>
              {m.jackpot.hall.retry}
            </Button>
          </div>
        ) : !state ? (
          <p aria-live="polite" className="py-6 text-center text-sm text-muted-foreground">
            {m.jackpot.hall.loading}
          </p>
        ) : (
          <>
            <section className="grid gap-3 rounded-2xl bg-muted/50 p-4 ring-1 ring-border">
              <div className="flex items-center gap-3">
                <img src="/jackpot/jar.webp" alt="" aria-hidden width={56} height={56} draggable={false} className="size-14 shrink-0 select-none drop-shadow-md" />
                <div className="grid min-w-0 gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground">{m.jackpot.hall.poolLabel}</span>
                  <span className="text-2xl font-bold tracking-tight tabular-nums">
                    {fmt(m.jackpot.pool, { n: nf.format(state.pool) })}
                  </span>
                </div>
              </div>
              <Progress
                value={pct}
                aria-label={fmt(m.jackpot.hall.fill, { pct })}
                className="[&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-track]]:bg-foreground/15"
              />
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">{fmt(m.jackpot.hall.fill, { pct })}</span>
                <span className="tabular-nums">{fmt(m.jackpot.hall.cap, { n: nf.format(state.cap) })}</span>
              </div>
            </section>

            <section aria-labelledby="jackpot-recent" className="grid gap-2">
              <h3 id="jackpot-recent" className="text-base font-semibold tracking-tight">
                {m.jackpot.hall.recent}
              </h3>
              {state.recent.length === 0 ? (
                <Empty className="rounded-xl border border-dashed py-8">
                  <EmptyHeader>
                    <EmptyMedia>
                      <img src="/jackpot/jar.webp" alt="" aria-hidden width={48} height={48} draggable={false} className="size-12 opacity-60 grayscale select-none" />
                    </EmptyMedia>
                    <EmptyTitle>{m.jackpot.hall.emptyTitle}</EmptyTitle>
                    <EmptyDescription>{m.jackpot.hall.emptyDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ol className="grid gap-1.5">
                  {state.recent.map((w) => (
                    <li
                      key={`${w.wonAt}-${w.gameSlug}-${w.amount}`}
                      className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5 ring-1 ring-border"
                    >
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate text-sm font-medium">{w.name || m.jackpot.someone}</span>
                        <span className="flex min-w-0 gap-x-2 text-xs text-muted-foreground">
                          <span className="truncate">{findGame(w.gameSlug)?.title[locale] ?? w.gameSlug}</span>
                          <time className="shrink-0" dateTime={new Date(w.wonAt).toISOString()}>
                            {timeAgo(w.wonAt, now, locale)}
                          </time>
                        </span>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                        <HugeiconsIcon icon={Ticket01Icon} className="size-4 text-primary" aria-hidden />
                        {fmt(m.jackpot.pool, { n: nf.format(w.amount) })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
