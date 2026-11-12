import { CheckmarkCircle02Icon, GoogleIcon, Share08Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";
import { BadgeGrid } from "#/components/shared/profile/badge-grid";
import { PassportHero } from "#/components/shared/profile/passport-hero";
import { StatsPanel } from "#/components/shared/profile/stats-panel";
import { Button } from "#/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle } from "#/lib/auth-client";
import { fmt } from "#/lib/i18n";
import type { CheckinClaim, CheckinMilestone } from "#/server/checkin";
import { type Profile, getMyProfileFn } from "#/server/profile";
import { useCheckin } from "#/stores/checkin";
import { profilePublicOf, useProfilePublic } from "#/stores/profile-public";
import { useTickets } from "#/stores/tickets";
import { CheckinTrack } from "./checkin-track";
import { MilestoneDialog } from "./milestone-dialog";

/**
 * /profile: the signed-in player's Engames Passport. The hero, the daily
 * check-in road, the badge album and the stats. Signed out, a sign-in prompt.
 */
export function ProfileView() {
  const m = useMessages();
  const { data, isPending } = useSession();
  const userId = isPending ? undefined : (data?.user.id ?? null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [milestone, setMilestone] = useState<CheckinMilestone | null>(null);
  const checkin = useCheckin((s) => (s.userId === userId ? s.state : null));
  const loadCheckin = useCheckin((s) => s.load);
  const claim = useCheckin((s) => s.claim);
  const balance = useTickets((s) => (s.userId === userId ? s.balance : null));
  const isPublic = useProfilePublic((s) => profilePublicOf(s, userId ?? undefined, profile?.owner?.profilePublic));

  const load = useCallback(() => {
    setFailed(false);
    getMyProfileFn()
      .then(setProfile)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!userId) return;
    load();
    void loadCheckin(userId, true);
  }, [userId, load, loadCheckin]);

  const landed = (c: CheckinClaim) => {
    if (userId && useTickets.getState().userId === userId) useTickets.getState().set(c.balance);
    if (c.milestone) setMilestone(c.milestone);
    // XP, level and badges move with a check-in: read them again, quietly
    getMyProfileFn()
      .then(setProfile)
      .catch(() => {});
  };

  if (userId === null) {
    return (
      <main className="grid content-start">
        <Empty className="rounded-3xl border border-dashed bg-card/50 py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserCircleIcon} />
            </EmptyMedia>
            <EmptyTitle>{m.profile.signInTitle}</EmptyTitle>
            <EmptyDescription>{m.profile.signInHint}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" className="h-11 rounded-full px-6" onClick={() => void signInWithGoogle("/profile")}>
              <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
              {m.profile.signIn}
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  if (failed && !profile) {
    return (
      <main className="grid content-start justify-items-start gap-3">
        <p role="alert" className="text-sm text-muted-foreground">
          {m.profile.loadError}
        </p>
        <Button variant="secondary" onClick={load}>
          {m.profile.retry}
        </Button>
      </main>
    );
  }

  if (!profile) return <ProfileSkeleton />;

  return (
    <main className="grid w-full content-start gap-4 md:gap-6">
      <div className="grid gap-2">
        <PassportHero
          profile={profile}
          streakDay={checkin?.streakDay}
          balance={balance ?? undefined}
          actions={isPublic ? <ShareButton userId={profile.userId} /> : undefined}
        />
        {!isPublic && <p className="px-2 text-sm text-muted-foreground">{m.profile.privateNote}</p>}
      </div>
      {checkin ? (
        <CheckinTrack state={checkin} onClaim={claim} onLanded={landed} onExpired={() => void loadCheckin(userId ?? null, true)} />
      ) : (
        <div className="h-80 animate-pulse rounded-3xl bg-card" aria-hidden />
      )}
      <BadgeGrid badges={profile.badges} />
      <StatsPanel profile={profile} />
      {milestone && <MilestoneDialog milestone={milestone} onClose={() => setMilestone(null)} />}
    </main>
  );
}

/** Copies the /u/<id> link to the clipboard and says so for a moment. */
function ShareButton({ userId }: { userId: string }) {
  const m = useMessages();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const url = typeof window === "undefined" ? `/u/${userId}` : `${window.location.origin}/u/${userId}`;

  useEffect(() => {
    if (status === "idle") return;
    const id = window.setTimeout(() => setStatus("idle"), status === "copied" ? 2000 : 6000);
    return () => window.clearTimeout(id);
  }, [status]);

  const copy = () =>
    navigator.clipboard
      .writeText(url)
      .then(() => setStatus("copied"))
      .catch(() => setStatus("failed"));

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" className="h-9 rounded-full px-3.5" onClick={() => void copy()}>
        <HugeiconsIcon icon={status === "copied" ? CheckmarkCircle02Icon : Share08Icon} data-icon="inline-start" className={status === "copied" ? "text-brand" : undefined} />
        {status === "copied" ? m.profile.copied : m.profile.share}
      </Button>
      <span role="status" className="sr-only">
        {status === "copied" ? m.profile.copied : ""}
      </span>
      {status === "failed" && (
        <p role="alert" className="absolute top-full right-0 z-10 mt-2 w-64 rounded-xl bg-popover p-3 text-xs break-all shadow-lg ring-1 ring-border">
          {fmt(m.profile.copyFailed, { url })}
        </p>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <main className="grid w-full content-start gap-4 md:gap-6" aria-busy>
      <div className="h-80 animate-pulse rounded-3xl bg-card sm:h-64" />
      <div className="h-80 animate-pulse rounded-3xl bg-card" />
      <div className="h-64 animate-pulse rounded-3xl bg-card" />
    </main>
  );
}
