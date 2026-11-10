import { GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CouponGrant, CouponReward, GameManifest } from "@web-games/core";
import { type FormEvent, useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle } from "#/lib/auth-client";
import { fmt } from "#/lib/i18n";
import { redeemCode } from "#/server/coupons";

/**
 * The portal's "redeem a code" dialog for games with `manifest.coupons`. Signed
 * out: explains and offers Google sign-in. Signed in: one code field. On success
 * it shows the rewards and hands the grant to `onGrant`.
 */
export function CouponDialog({
  game,
  onClose,
  onGrant,
}: {
  game: GameManifest;
  onClose: () => void;
  onGrant: (grant: CouponGrant) => void;
}) {
  const m = useMessages();
  const { data: session, isPending } = useSession();
  const signedIn = Boolean(session?.user);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<CouponGrant | null>(null);
  const codeId = useId();

  const rewardText = (r: CouponReward) => {
    const kind = m.coupon.rewardKinds[r.kind];
    return kind ? fmt(kind, { amount: r.amount }) : fmt(m.coupon.reward, { amount: r.amount, kind: r.kind });
  };

  const fail = (reason: string) => setError(m.coupon.errors[reason] ?? m.coupon.errors.generic);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || code.trim().length < 4) return;
    setPending(true);
    setError(null);
    try {
      const r = await redeemCode({ data: { slug: game.slug, code: code.trim() } });
      if (r.ok) {
        const grant = { code: r.code, rewards: r.rewards };
        setGranted(grant);
        setCode("");
        onGrant(grant);
      } else {
        fail(r.reason);
      }
    } catch (err) {
      fail(err instanceof Error && err.message === "sign-in-required" ? "sign-in-required" : "generic");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md">
        {granted ? (
          <>
            <DialogHeader>
              <DialogTitle>{m.coupon.successTitle}</DialogTitle>
              <DialogDescription>{fmt(m.coupon.successHint, { code: granted.code })}</DialogDescription>
            </DialogHeader>
            <ul className="grid gap-2 rounded-2xl bg-muted/60 p-4 text-center text-lg font-semibold text-primary">
              {granted.rewards.map((r) => (
                <li key={r.kind}>{rewardText(r)}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-11 flex-1" onClick={() => setGranted(null)}>
                {m.coupon.redeemAnother}
              </Button>
              <Button className="h-11 flex-1" onClick={onClose}>
                {m.coupon.close}
              </Button>
            </div>
          </>
        ) : !isPending && !signedIn ? (
          <>
            <DialogHeader>
              <DialogTitle>{m.coupon.signInTitle}</DialogTitle>
              <DialogDescription>{m.coupon.signInHint}</DialogDescription>
            </DialogHeader>
            <Button size="lg" className="h-11" onClick={() => void signInWithGoogle(window.location.pathname)}>
              <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
              {m.coupon.signIn}
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{m.coupon.title}</DialogTitle>
              <DialogDescription>{m.coupon.description}</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <div className="grid gap-1.5">
                <label htmlFor={codeId} className="text-sm font-medium">
                  {m.coupon.codeLabel}
                </label>
                <Input
                  id={codeId}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  maxLength={64}
                  placeholder={m.coupon.codePlaceholder}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  disabled={isPending}
                  className="h-11 uppercase"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${codeId}-error` : undefined}
                />
              </div>
              {error && (
                <p id={`${codeId}-error`} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" className="h-11" disabled={pending || isPending || code.trim().length < 4}>
                {pending ? m.coupon.redeeming : m.coupon.redeem}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
