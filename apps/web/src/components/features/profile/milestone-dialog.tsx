import { play } from "cuelume";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { BadgeSticker } from "#/components/shared/profile/badge-grid";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt, intlTag } from "#/lib/i18n";
import { BADGES } from "#/lib/profile";
import type { CheckinMilestone } from "#/server/checkin";

/** A streak milestone just paid: its bonus and the badge it unlocked, slapped on like a sticker. */
export function MilestoneDialog({ milestone, onClose }: { milestone: CheckinMilestone; onClose: () => void }) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const badge = BADGES.find((b) => b.id === milestone.badge);
  const nf = new Intl.NumberFormat(intlTag(locale));

  useEffect(() => {
    play("success", { emphasis: "strong" });
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:max-w-sm">
        <motion.div
          className="mx-auto mt-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.2, rotate: -40 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -6 }}
          transition={reduce ? { duration: 0.3 } : { type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
        >
          <BadgeSticker id={milestone.badge} unlocked size="lg" />
        </motion.div>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-2xl font-bold">{fmt(m.profile.milestoneDialog.title, { days: milestone.days })}</DialogTitle>
          <DialogDescription>{fmt(m.profile.milestoneDialog.body, { bonus: nf.format(milestone.bonus) })}</DialogDescription>
        </DialogHeader>
        {badge && <p className="text-base font-semibold text-highlight">{badge.name[locale]}</p>}
        <DialogFooter className="sm:justify-center">
          <Button size="lg" className="h-11 w-full rounded-full sm:w-auto sm:px-8" onClick={onClose}>
            {m.profile.milestoneDialog.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
