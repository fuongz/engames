import { PlusSignSquareIcon, Share08Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { RichText } from "#/components/shared/i18n/rich-text";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { useMessages } from "#/hooks/use-messages";
import { useInstallStore } from "#/stores/install";

/** Icons for the Safari steps: Share, then Add to Home Screen, then nothing. */
const STEP_ICONS = [Share08Icon, PlusSignSquareIcon, undefined];

/** iOS has no install prompt API, so "Install the app" opens these Safari steps instead. */
export function InstallHelpDialog() {
  const m = useMessages();
  const open = useInstallStore((s) => s.iosHelpOpen);
  const setOpen = useInstallStore((s) => s.setIosHelpOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.installHelp.title}</DialogTitle>
          <DialogDescription>{m.installHelp.description}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2.5">
          {m.installHelp.steps.map((step, i) => (
            <Step key={step} n={i + 1} icon={STEP_ICONS[i]}>
              <RichText text={step} />
            </Step>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, icon, children }: { n: number; icon?: typeof Share08Icon; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-muted p-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="flex-1">{children}</span>
      {icon && <HugeiconsIcon icon={icon} className="size-5 text-muted-foreground" />}
    </li>
  );
}
