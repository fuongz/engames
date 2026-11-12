import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { useMessages } from "#/hooks/use-messages";
import { DISPLAY_NAME_MAX } from "#/lib/avatar";
import { fmt } from "#/lib/i18n";
import { updateDisplayNameFn } from "#/server/profile";

/**
 * The pencil next to the owner's name and the small dialog it opens. Enter
 * saves, Esc cancels. `onSaved` runs after a save so the page can read the
 * profile and the session again.
 */
export function DisplayNameEditButton({ name, onSaved }: { name: string; onSaved: () => void | Promise<void> }) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={m.profile.displayName.edit}
        // The ::after widens the touch target past the 28px visible button
        className="relative shrink-0 rounded-full text-muted-foreground after:absolute after:-inset-1.5 after:content-['']"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !(busy && !next) && setOpen(next)}>
        <DialogContent showCloseButton={false} className="gap-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-sm">
          <DisplayNameForm name={name} onClose={() => setOpen(false)} onSaved={onSaved} onBusyChange={setBusy} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Lives only while the dialog is open, so every opening starts from the saved name. */
function DisplayNameForm({
  name,
  onClose,
  onSaved,
  onBusyChange,
}: {
  name: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const m = useMessages();
  const t = m.profile.displayName;
  const inputId = useId();
  const counterId = useId();
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && !saving;

  useEffect(() => onBusyChange(saving), [saving, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      await updateDisplayNameFn({ data: { name: trimmed } });
      void Promise.resolve(onSaved()).catch(() => {});
      onClose();
    } catch (err) {
      setError(t.errors[err instanceof Error ? err.message : ""] ?? t.errors.generic);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">{t.title}</DialogTitle>
        <DialogDescription>{t.description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          {t.label}
        </label>
        <Input
          id={inputId}
          value={value}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="done"
          autoFocus
          disabled={saving}
          aria-invalid={error ? true : undefined}
          aria-describedby={counterId}
          className="h-11 px-4 text-base"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <p id={counterId} className="text-right text-xs text-muted-foreground tabular-nums">
          {fmt(t.counter, { n: value.length, max: DISPLAY_NAME_MAX })}
        </p>
      </div>
      {/* Always in the layout, so an error appearing never moves the buttons */}
      <p role="alert" className="min-h-5 text-sm text-destructive">
        {error}
      </p>
      <DialogFooter>
        <Button type="button" variant="secondary" className="h-11 rounded-full px-6" disabled={saving} onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="submit" className="h-11 rounded-full px-6" disabled={!canSave} aria-busy={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
