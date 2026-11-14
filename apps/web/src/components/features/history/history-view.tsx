import { GoogleIcon, WorkHistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { useHistoryConsent } from "#/hooks/use-history-consent";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { signInWithGoogle } from "#/lib/auth-client";
import { fmt, intlTag } from "#/lib/i18n";
import { type HistoryEntry, getMatchHistory } from "#/server/history";
import { tidyDetail } from "#/lib/format";

const PAGE = 20;

/** The signed-in player's saved online matches, newest first. */
export function HistoryView() {
  const m = useMessages();
  const consent = useHistoryConsent();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (before?: number) => {
    try {
      const page = await getMatchHistory({ data: { limit: PAGE, before } });
      setEntries((prev) => [...(before ? (prev ?? []) : []), ...(page ?? [])]);
      setMore((page?.length ?? 0) === PAGE);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (consent.signedIn) void load();
  }, [consent.signedIn, load]);

  return (
    <main className="grid content-start gap-5 md:gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{m.history.title}</h1>
        <p className="text-sm text-muted-foreground">{m.history.description}</p>
      </div>
      {!consent.signedIn ? (
        <HistoryEmpty title={m.history.title} hint={m.history.signIn}>
          <Button onClick={() => void signInWithGoogle()}>
            <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
            {m.account.signIn}
          </Button>
        </HistoryEmpty>
      ) : failed && !entries ? (
        <p className="text-sm text-muted-foreground">{m.history.failed}</p>
      ) : entries === null ? (
        <ul className="grid gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <HistoryEmpty title={m.history.emptyTitle} hint={consent.value === false ? m.history.emptyOff : m.history.emptyOn}>
          {consent.value === false && (
            <Button variant="secondary" onClick={() => void consent.set(true)}>
              {m.history.turnOn}
            </Button>
          )}
        </HistoryEmpty>
      ) : (
        <>
          <ul className="grid gap-2">
            {entries.map((e) => (
              <HistoryRow key={e.id} entry={e} />
            ))}
          </ul>
          {more && (
            <Button variant="outline" className="justify-self-center" onClick={() => void load(entries.at(-1)?.id)}>
              {m.history.more}
            </Button>
          )}
        </>
      )}
    </main>
  );
}

function HistoryEmpty({ title, hint, children }: { title: string; hint: string; children?: ReactNode }) {
  return (
    <Empty className="rounded-2xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={WorkHistoryIcon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{hint}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

function HistoryRow({ entry: e }: { entry: HistoryEntry }) {
  const m = useMessages();
  const locale = useLocale();
  const game = findGame(e.gameSlug);
  const names = e.others.map((o) => o.name).join(", ");
  const who = e.others.length === 0 ? m.history.solo : fmt(e.mode === "coop" ? m.history.teamWith : m.history.against, { names });
  // The room's settings, labelled as the lobby showed them (e.g. "Bo5")
  const settings = (game?.online?.settings ?? []).flatMap((s) => s.choices.find((c) => c.value === e.settings[s.key])?.label[locale] ?? []);
  const when = new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(e.playedAt * 1000));
  const outcome = e.you.outcome;

  return (
    <li>
      <Link
        to="/games/$slug"
        params={{ slug: e.gameSlug }}
        className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {game && <img src={game.poster[locale]} alt="" className="aspect-square size-14 shrink-0 rounded-xl object-cover object-top" />}
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{game?.title[locale] ?? e.gameSlug}</span>
            {settings.map((s) => (
              <Badge key={s} variant="outline">
                {s}
              </Badge>
            ))}
          </span>
          <span className="truncate text-sm text-muted-foreground">{who}</span>
          <span className="flex min-w-0 gap-x-2 text-xs text-muted-foreground">
            {e.you.detail && <span className="truncate">{tidyDetail(e.you.detail)}</span>}
            <time className="shrink-0" dateTime={new Date(e.playedAt * 1000).toISOString()}>
              {when}
            </time>
          </span>
        </span>
        {outcome && (
          <Badge variant={outcome === "win" ? "default" : outcome === "loss" ? "secondary" : "outline"} className="shrink-0">
            {m.history[outcome]}
          </Badge>
        )}
      </Link>
    </li>
  );
}
