import { GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "@tanstack/react-router";
import type { GameManifest, ScoreReport } from "@web-games/games";
import { play } from "cuelume";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { type FormEvent, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { LeaderboardList } from "#/components/shared/leaderboard/leaderboard-list";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle } from "#/lib/auth-client";
import { fmt, intlTag } from "#/lib/i18n";
import { EASE_OUT } from "#/lib/motion";
import { cn } from "#/lib/utils";
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

// The end of a run is rare and earned, so it gets the one celebratory beat:
// the score counts up. The state swaps around it are quick, quiet bridges.
const COUNT_UP = { duration: 0.7, ease: EASE_OUT };
const RISE = {
  initial: { opacity: 0, transform: "translateY(8px)" },
  animate: { opacity: 1, transform: "translateY(0px)" },
  transition: { duration: 0.25, ease: EASE_OUT },
};

// A new best or a podium place earns a burst: tokens only, never a literal colour.
const CONFETTI_COLORS = ["bg-primary", "bg-highlight", "bg-brand", "bg-brand-alt", "bg-warm"];
const CONFETTI_COUNT = 28;

/** One burst of paper from the score, thrown up and falling away. Skipped under reduced motion. */
function Confetti() {
  const [bits] = useState(() =>
    Array.from({ length: CONFETTI_COUNT }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const reach = 70 + Math.random() * 90;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        x: Math.cos(angle) * reach,
        y: Math.sin(angle) * reach,
        spin: (Math.random() - 0.5) * 720,
        duration: 0.9 + Math.random() * 0.5,
      };
    }),
  );
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className={cn("absolute h-2.5 w-1.5 rounded-[2px]", b.color)}
          initial={{ opacity: 1, transform: "translate(0px, 0px) rotate(0deg)" }}
          animate={{
            opacity: [1, 1, 0],
            // Up and out, then gravity takes it below where it started
            transform: [
              "translate(0px, 0px) rotate(0deg)",
              `translate(${b.x}px, ${b.y}px) rotate(${b.spin / 2}deg)`,
              `translate(${b.x * 1.3}px, ${b.y + 120}px) rotate(${b.spin}deg)`,
            ],
          }}
          transition={{ duration: b.duration, times: [0, 0.4, 1], ease: EASE_OUT }}
        />
      ))}
    </span>
  );
}

/** The rank lands with a small pop: the one bouncy moment, saved for the payoff. */
const RANK_POP = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: "spring", duration: 0.45, bounce: 0.35 },
} as const;

/** Counts from 0 to `value` once, writing the DOM directly so React doesn't re-render per frame. */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  formatRef.current = format;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    play("count", { duration: COUNT_UP.duration * 1000 });
    const controls = animate(0, value, { ...COUNT_UP, onUpdate: (v) => (el.textContent = formatRef.current(Math.round(v))) });
    return () => controls.stop();
  }, [value, reduce]);
  // The rendered text is the final value: right without JS, and for screen readers.
  return (
    <span ref={ref} className="text-4xl font-bold tabular-nums">
      {format(value)}
    </span>
  );
}

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
  const reduce = useReducedMotion();
  const celebrate = !reduce && result !== null && (result.rank <= 3 || (signedIn && result.improved));

  const save = async (asName?: string) => {
    setStatus("saving");
    setError(null);
    try {
      const saved = await submitScore({ data: { slug: game.slug, score: report.score, detail: report.detail, name: asName } });
      if (asName) localStorage.setItem(NAME_KEY, asName.trim());
      clearPending();
      setResult(saved);
      setStatus("saved");
      play("success", { emphasis: saved.improved ? "strong" : "normal" });
      setBoard(await getLeaderboard({ data: { slug: game.slug, limit: 10 } }));
      void router.invalidate(); // refresh the board on the game page
    } catch {
      setStatus("error");
      setError(m.score.saveFailed);
      play("error");
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{status === "saved" ? m.score.savedTitle : m.score.saveTitle}</DialogTitle>
          <DialogDescription>{game.title[locale]}</DialogDescription>
        </DialogHeader>

        <div className="relative grid justify-items-center gap-1 rounded-2xl bg-muted/60 py-4">
          {celebrate && <Confetti />}
          <CountUp value={report.score} format={(n) => score.format(n)} />
          {report.detail && <span className="text-sm text-muted-foreground">{report.detail}</span>}
          {result && (
            <motion.span {...RANK_POP} className="mt-1 text-sm font-semibold text-primary">
              {fmt(m.score.rank, { rank: result.rank })}
              {signedIn && !result.improved && fmt(m.score.stillBest, { best: score.format(result.best) })}
            </motion.span>
          )}
        </div>

        {/* initial={false}: the opening state rides the dialog's zoom; only later swaps rise */}
        <AnimatePresence initial={false}>
          {status === "saved" && board ? (
            <motion.div key="board" {...RISE}>
              <LeaderboardList entries={board} highlightId={result?.id} cascade />
            </motion.div>
          ) : signedIn ? (
            <motion.p key="saving" {...RISE} className="text-center text-sm text-muted-foreground">
              {status === "error" ? error : fmt(m.score.savingAs, { name: session.data?.user.name ?? "" })}
            </motion.p>
          ) : (
            <motion.form key="form" {...RISE} onSubmit={submitName} className="grid gap-3">
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
            </motion.form>
          )}
        </AnimatePresence>

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
