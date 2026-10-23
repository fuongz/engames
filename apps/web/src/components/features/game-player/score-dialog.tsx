import { GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "@tanstack/react-router";
import type { GameManifest, ScoreReport } from "@web-games/games";
import { type FormEvent, useEffect, useEffectEvent, useId, useState } from "react";
import { LeaderboardList } from "#/components/shared/leaderboard/leaderboard-list";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle } from "#/lib/auth-client";
import { fmt, intlTag } from "#/lib/i18n";
import { type LeaderboardEntry, type SaveResult, getLeaderboard, submitScore } from "#/server/leaderboard";

const NAME_KEY = "engames:portal:playerName";
const PENDING_KEY = "engames:portal:pendingScore";
const PENDING_TTL = 30 * 60 * 1000;

interface Pending extends ScoreReport {
  slug: string;
  at: number;
}

/** A score waiting for the Google round trip, if it belongs to this game and is fresh. */
export function takePendingScore(slug: string): ScoreReport | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (p.slug !== slug || Date.now() - p.at > PENDING_TTL) return null;
    return { score: p.score, detail: p.detail };
  } catch {
    return null;
  }
}

const clearPending = () => sessionStorage.removeItem(PENDING_KEY);

/**
 * End-of-run dialog. Signed in: saves straight away. Signed out: asks for a
 * name, or offers Google sign-in (the score survives the redirect).
 */
export function ScoreDialog({
  game,
  report,
  onClose,
  onReplay,
}: {
  game: GameManifest;
  report: ScoreReport;
  onClose: () => void;
  onReplay: () => void;
}) {
  const locale = useLocale();
  const m = useMessages();
  const score = new Intl.NumberFormat(intlTag(locale));
  const router = useRouter();
  const session = useSession();
  const signedIn = Boolean(session.data?.user);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const nameId = useId();

  const save = async (asName?: string) => {
    setStatus("saving");
    setError(null);
    try {
      const saved = await submitScore({ data: { slug: game.slug, score: report.score, detail: report.detail, name: asName } });
      if (asName) localStorage.setItem(NAME_KEY, asName.trim());
      clearPending();
      setResult(saved);
      setStatus("saved");
      setBoard(await getLeaderboard({ data: { slug: game.slug, limit: 10 } }));
      void router.invalidate(); // refresh the board on the game page
    } catch {
      setStatus("error");
      setError(m.score.saveFailed);
    }
  };

  // Signed-in players never type anything: save as soon as the session is known.
  // An effect event reads the latest save() without re-running on every render.
  const autoSave = useEffectEvent(() => {
    if (status === "idle") void save();
  });
  useEffect(() => {
    if (signedIn) autoSave();
  }, [signedIn]);

  const close = () => {
    clearPending();
    onClose();
  };

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.replace(/\s+/g, " ").trim();
    if (trimmed.length < 2) {
      setError(m.score.nameTooShort);
      return;
    }
    void save(trimmed);
  };

  const signInAndSave = () => {
    const pending: Pending = { ...report, slug: game.slug, at: Date.now() };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    void signInWithGoogle(window.location.pathname);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{status === "saved" ? m.score.savedTitle : m.score.saveTitle}</DialogTitle>
          <DialogDescription>{game.title[locale]}</DialogDescription>
        </DialogHeader>

        <div className="grid justify-items-center gap-1 rounded-2xl bg-muted/60 py-4">
          <span className="text-4xl font-bold tabular-nums">{score.format(report.score)}</span>
          {report.detail && <span className="text-sm text-muted-foreground">{report.detail}</span>}
          {result && (
            <span className="mt-1 text-sm font-semibold text-primary">
              {fmt(m.score.rank, { rank: result.rank })}
              {signedIn && !result.improved && fmt(m.score.stillBest, { best: score.format(result.best) })}
            </span>
          )}
        </div>

        {status === "saved" && board ? (
          <LeaderboardList entries={board} highlightId={result?.id} />
        ) : signedIn ? (
          <p className="text-center text-sm text-muted-foreground">
            {status === "error" ? error : fmt(m.score.savingAs, { name: session.data?.user.name ?? "" })}
          </p>
        ) : (
          <form onSubmit={submitName} className="grid gap-3">
            <div className="grid gap-1.5">
              <label htmlFor={nameId} className="text-sm font-medium">
                {m.score.nameLabel}
              </label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder={m.score.namePlaceholder}
                autoFocus
                className="h-11"
                aria-invalid={error ? true : undefined}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="h-11" disabled={status === "saving"}>
              {status === "saving" ? m.score.saving : m.score.save}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-11" onClick={signInAndSave}>
              <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
              {m.score.signInToSave}
            </Button>
          </form>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="h-10 flex-1" onClick={() => {
              clearPending();
              onReplay();
            }}>
            {m.score.playAgain}
          </Button>
          <Button variant="ghost" className="h-10 flex-1" onClick={close}>
            {status === "saved" ? m.score.close : m.score.skip}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
