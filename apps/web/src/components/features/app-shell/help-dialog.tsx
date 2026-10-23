import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { RichText } from "#/components/shared/i18n/rich-text";
import { useMessages } from "#/hooks/use-messages";

/** "Help": how the portal works, with its own sidebar trigger. */
export function HelpDialog({ triggerClassName }: { triggerClassName: string }) {
  const m = useMessages();
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={triggerClassName} />}>
        <HugeiconsIcon icon={HelpCircleIcon} className="size-5" />
        {m.help.trigger}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{m.help.title}</DialogTitle>
          <DialogDescription>{m.help.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {m.help.tips.map((tip) => (
            <div key={tip.title} className="grid gap-1 rounded-2xl bg-muted p-3.5">
              <span className="font-semibold">{tip.title}</span>
              <span className="leading-relaxed text-muted-foreground">
                <RichText text={tip.body} />
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

