import { GlobeIcon, HelpCircleIcon, PlayIcon, Search01Icon, SmartphoneIcon, WifiOff01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { RichText } from "#/components/shared/i18n/rich-text";
import { useMessages } from "#/hooks/use-messages";

/** One icon per tip, in the order of `m.help.tips` (choose, search, install, offline, language). */
const TIP_ICONS = [PlayIcon, Search01Icon, SmartphoneIcon, WifiOff01Icon, GlobeIcon];

/** "Help": how the portal works, with its own sidebar trigger. A welcome sheet: brand, intro, then icon rows. */
export function HelpDialog({ triggerClassName }: { triggerClassName: string }) {
  const m = useMessages();
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={triggerClassName} />}>
        <HugeiconsIcon icon={HelpCircleIcon} className="size-5" />
        {m.help.trigger}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] gap-6 overflow-y-auto overscroll-contain">
        <div className="flex items-center gap-2.5">
          <img src="/icons/logo.svg" alt="" className="size-8 rounded-lg" />
          <span className="font-bold tracking-wide uppercase">Engames</span>
        </div>
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-xl">{m.help.title}</DialogTitle>
          <DialogDescription>{m.help.description}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-5 sm:px-4">
          {m.help.tips.map((tip, i) => (
            <li key={tip.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background text-muted-foreground shadow-xs">
                <HugeiconsIcon icon={TIP_ICONS[i] ?? HelpCircleIcon} className="size-5" aria-hidden />
              </span>
              <div className="grid gap-0.5 text-sm">
                <span className="font-semibold">{tip.title}</span>
                <span className="leading-relaxed text-muted-foreground">
                  <RichText text={tip.body} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
