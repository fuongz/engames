import {
  ArrowLeft01Icon,
  InformationCircleIcon,
  FullScreenIcon,
  RankingIcon,
  SmartphoneIcon,
  PlayIcon,
  Refresh01Icon,
  VolumeHighIcon,
  VolumeOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { audioBus, createStorage, type GameManifest, type GameModule, type OnlineMatch, loadGame, type ScoreReport } from "@web-games/games";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Progress } from "#/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { EASE_OUT, FADE, RISE_BLUR, stagger } from "#/lib/motion";
import { cn } from "#/lib/utils";
import { useLocaleStore } from "#/stores/locale";
import { usePlayStats } from "#/stores/play-stats";
import { OnlineEntry } from "#/components/features/online/online-entry";
import { OnlineSession } from "#/components/features/online/online-session";
import { ScoreDialog, takePendingScore } from "./score-dialog";

/** Give the game's own result screen a moment before the save dialog covers it. */
const REPORT_DELAY = 1300;

type GameInstance = ReturnType<GameModule["mount"]>;

/**
 * Mounts a canvas game. Below `lg` it takes over the whole screen (an app-like
 * view with safe-area padding); from `lg` up it sits inside the page.
 * `details` is shown in a dialog on phones, where there is no sidebar.
 */
export function GamePlayer({
  game,
  details,
  leaderboard,
  room,
}: {
  game: GameManifest;
  details: ReactNode;
  leaderboard: ReactNode;
  /** An online room code (from ?room=) when this game plays online. */
  room?: string;
}) {
  const online = room && game.online ? room : null;
  const navigate = useNavigate();
  const locale = useLocale();
  const m = useMessages();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GameInstance | null>(null);
  const [module, setModule] = useState<GameModule | null>(null);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [report, setReport] = useState<ScoreReport | null>(null);
  const reportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Back from Google sign-in with a run that was waiting to be saved
  useEffect(() => {
    const pending = takePendingScore(game.slug);
    if (pending) setReport(pending);
    return () => clearTimeout(reportTimer.current);
  }, [game.slug]);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [needsRotate, setNeedsRotate] = useState(false);
  const recordPlay = usePlayStats((s) => s.recordPlay);
  const landscape = game.orientation === "landscape";

  useEffect(() => {
    let alive = true;
    setModule(null);
    setStarted(false);
    loadGame(game.slug)
      .then((m) => alive && setModule(m))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [game.slug]);

  useEffect(() => {
    setMuted(audioBus.muted);
    setCanFullscreen(document.fullscreenEnabled);
    return audioBus.onMuteChange(setMuted);
  }, []);

  // While the player owns the phone screen, stop the page behind it from scrolling.
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      document.documentElement.style.overflow = media.matches ? "hidden" : "";
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Landscape games on a phone held upright: ask to rotate and hold the game.
  useEffect(() => {
    if (!landscape) return;
    const media = window.matchMedia("(orientation: portrait) and (max-width: 1023px)");
    const apply = () => setNeedsRotate(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [landscape]);

  useEffect(() => {
    if (needsRotate) instanceRef.current?.pause?.();
    else instanceRef.current?.resume?.();
  }, [needsRotate]);

  const mount = useCallback((match?: OnlineMatch) => {
    const stage = stageRef.current;
    if (!module || !stage) return;
    instanceRef.current?.destroy();
    stage.replaceChildren();
    instanceRef.current = module.mount(stage, {
      online: match,
      storage: createStorage(game.slug),
      audio: audioBus,
      // Read live: games redraw every frame, so a language switch shows at once
      locale: () => useLocaleStore.getState().locale,
      reportScore: (r) => {
        if (r.score <= 0) return;
        clearTimeout(reportTimer.current);
        reportTimer.current = setTimeout(() => setReport(r), REPORT_DELAY);
      },
    });
  }, [module, game.slug]);

  const unmount = useCallback(() => {
    instanceRef.current?.destroy();
    instanceRef.current = null;
    stageRef.current?.replaceChildren();
  }, []);

  // Online: the room says when a match starts (mount the game with it) and ends
  const onMatch = useCallback(
    (match: OnlineMatch | null) => {
      if (!match) {
        unmount();
        setStarted(false);
        return;
      }
      recordPlay(game.slug);
      setStarted(true);
      mount(match);
    },
    [mount, unmount, recordPlay, game.slug],
  );

  // Leaving a room any way (button, browser back) unmounts its match: the socket is gone
  useEffect(() => {
    if (!online) return;
    return () => {
      unmount();
      setStarted(false);
    };
  }, [online, unmount]);

  const leaveRoom = () => {
    unmount();
    setStarted(false);
    void navigate({ to: "/games/$slug", params: { slug: game.slug }, search: {} });
  };

  const start = () => {
    audioBus.unlock(); // this tap is the gesture browsers require before sound
    recordPlay(game.slug);
    setStarted(true);
    mount();
    if (landscape && window.matchMedia("(pointer: coarse)").matches) void lockLandscape(rootRef.current);
  };

  const toggleInfo = (open: boolean) => {
    setInfoOpen(open);
    if (open) instanceRef.current?.pause?.();
    else instanceRef.current?.resume?.();
  };

  const toggleBoard = (open: boolean) => {
    setBoardOpen(open);
    if (open) instanceRef.current?.pause?.();
    else instanceRef.current?.resume?.();
  };

  const replay = () => {
    setReport(null);
    if (started) mount();
    else start();
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground lg:relative lg:inset-auto lg:z-auto lg:self-start lg:overflow-hidden lg:rounded-2xl lg:shadow-2xl lg:ring-1 lg:ring-border",
        // Desktop: as big as fits under the top bar, centred, details go below.
        landscape
          ? "lg:mx-auto lg:w-full lg:max-w-[calc((100dvh-11rem)*16/9)]"
          : "lg:mx-auto lg:h-[calc(100dvh-9.5rem)] lg:min-h-[560px] lg:w-full lg:max-w-[calc((100dvh-9.5rem)*0.8)]",
      )}
    >
      {/* On short screens (a phone turned sideways) the toolbar folds into a
          floating cluster so the game gets the full height. */}
      <div className="flex shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)] lg:px-3 [@media(max-height:500px)]:absolute [@media(max-height:500px)]:top-2 [@media(max-height:500px)]:left-[max(0.5rem,env(safe-area-inset-left))] [@media(max-height:500px)]:z-10 [@media(max-height:500px)]:rounded-full [@media(max-height:500px)]:bg-background/60 [@media(max-height:500px)]:p-1 [@media(max-height:500px)]:backdrop-blur-md">
        <div className="flex h-12 flex-1 items-center gap-1 [@media(max-height:500px)]:h-auto">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={m.player.back}
            nativeButton={false}
            render={<Link to="/" />}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <h1 className="min-w-0 flex-1 truncate font-semibold [@media(max-height:500px)]:hidden">{game.title[locale]}</h1>
          <ToolButton label={m.player.leaderboard} className="lg:hidden" onClick={() => toggleBoard(true)}>
            <HugeiconsIcon icon={RankingIcon} />
          </ToolButton>
          <ToolButton label={m.player.help} className="lg:hidden" onClick={() => toggleInfo(true)}>
            <HugeiconsIcon icon={InformationCircleIcon} />
          </ToolButton>
          <ToolButton label={muted ? m.player.unmute : m.player.mute} onClick={() => audioBus.setMuted(!muted)}>
            <HugeiconsIcon icon={muted ? VolumeOffIcon : VolumeHighIcon} />
          </ToolButton>
          <ToolButton label={m.player.restart} disabled={!started || online !== null} onClick={() => mount()} className="[@media(max-height:500px)]:hidden">
            <HugeiconsIcon icon={Refresh01Icon} />
          </ToolButton>
          {/* Phones already get a full-screen view (and iOS has no fullscreen API) */}
          {canFullscreen && (
            <ToolButton
              label={m.player.fullscreen}
              className="hidden lg:inline-flex"
              onClick={() => void rootRef.current?.requestFullscreen()}
            >
              <HugeiconsIcon icon={FullScreenIcon} />
            </ToolButton>
          )}
        </div>
      </div>

      {/* The game draws into the letterbox itself (stage bleed), so the canvas can
          run under the home indicator; its logical area stays centred above it. */}
      <div className={cn("relative min-h-0 flex-1 bg-black", landscape && "lg:aspect-video lg:flex-none")}>
        {/* Landscape phones: keep the canvas clear of the notch / camera cutout */}
        <div
          ref={stageRef}
          className="absolute inset-y-0 left-[env(safe-area-inset-left)] right-[env(safe-area-inset-right)]"
        />
        {/* Fades off the first frame of the game instead of cutting to it */}
        <AnimatePresence>
          {online
            ? module && <OnlineSession game={game} code={online} onMatch={onMatch} onLeave={leaveRoom} />
            : !started && <StartScreen game={game} ready={module !== null} failed={failed} onStart={start} />}
        </AnimatePresence>
        {needsRotate && <RotateHint />}
      </div>

      <Dialog open={infoOpen} onOpenChange={toggleInfo}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>{game.title[locale]}</DialogTitle>
          </DialogHeader>
          {details}
        </DialogContent>
      </Dialog>

      <Dialog open={boardOpen} onOpenChange={toggleBoard}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>{m.player.leaderboard}</DialogTitle>
          </DialogHeader>
          {leaderboard}
        </DialogContent>
      </Dialog>

      {report && <ScoreDialog game={game} report={report} onClose={() => setReport(null)} onReplay={replay} />}
    </div>
  );
}

const ARRIVE = stagger(0.1);
// Exits are shorter than enters
const LEAVE = { duration: 0.15, ease: EASE_OUT };

/** Android allows an orientation lock only while fullscreen; iOS has neither, so the rotate hint covers it. */
async function lockLandscape(el: HTMLElement | null) {
  try {
    if (el && !document.fullscreenElement && document.fullscreenEnabled) await el.requestFullscreen({ navigationUI: "hide" });
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    // Not supported here: the rotate hint is the fallback.
  }
}

function RotateHint() {
  const m = useMessages();
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-background/90 p-8 text-center backdrop-blur-md">
      <div className="grid justify-items-center gap-4">
        <HugeiconsIcon icon={SmartphoneIcon} className="size-14 animate-[spin_2.4s_ease-in-out_infinite] text-primary motion-reduce:animate-none" />
        <p className="text-lg font-semibold">{m.player.rotateTitle}</p>
        <p className="max-w-64 text-sm text-muted-foreground">{m.player.rotateHint}</p>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  children,
  className,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label} className={className} disabled={disabled} onClick={onClick} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StartScreen({
  game,
  ready,
  failed,
  onStart,
}: {
  game: GameManifest;
  ready: boolean;
  failed: boolean;
  onStart: () => void;
}) {
  const locale = useLocale();
  const m = useMessages();
  // Leaving: let taps through to the game straight away, not after the fade.
  const present = useIsPresent();
  // Arriving: art, line, then the button, 100ms apart
  const piece = useReducedMotion() ? FADE : RISE_BLUR;
  return (
    // container-type:size lets the poster size itself by the frame's height (cqh),
    // so the Play button always fits, even in a short 16:9 desktop frame.
    <motion.div
      exit={{ opacity: 0 }}
      transition={LEAVE}
      className={cn("absolute inset-0 grid place-items-center overflow-hidden p-6 [container-type:size]", !present && "pointer-events-none")}
    >
      <img src={game.banner} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-50 blur-2xl" />
      <motion.div
        variants={ARRIVE}
        initial="hidden"
        animate="shown"
        className="relative grid w-full max-w-xs justify-items-center gap-4 text-center [@media(max-height:500px)]:gap-3"
      >
        {/* A sideways phone has no room for the poster; show the title instead */}
        <motion.img
          src={game.poster[locale]}
          alt=""
          variants={piece}
          exit={{ transform: "scale(0.96)" }}
          transition={LEAVE}
          className="aspect-[3/4] h-[min(42cqh,320px)] w-auto rounded-3xl object-cover shadow-2xl ring-1 ring-white/10 [@media(max-height:500px)]:hidden"
        />
        <motion.h2 variants={piece} className="hidden text-2xl font-bold tracking-tight [@media(max-height:500px)]:block">
          {game.title[locale]}
        </motion.h2>
        <motion.p variants={piece} className="line-clamp-2 text-sm text-muted-foreground">
          {game.tagline[locale]}
        </motion.p>
        <motion.div variants={piece} className="grid w-full justify-items-center gap-4 [@media(max-height:500px)]:gap-3">
          {failed ? (
            <p className="text-sm text-destructive">{m.player.loadFailed}</p>
          ) : (
            <>
              <Button size="lg" className="h-12 w-full max-w-60 rounded-full text-base font-semibold" disabled={!ready} onClick={onStart} data-cuelume-emphasis="strong">
                <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />
                {ready ? m.player.play : m.player.loading}
              </Button>
              {!ready && <Progress value={null} className="w-full max-w-60" aria-label={m.player.loadingLabel} />}
              {ready && <OnlineEntry game={game} />}
            </>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
