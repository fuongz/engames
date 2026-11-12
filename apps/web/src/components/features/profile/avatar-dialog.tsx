import { Camera01Icon, Delete02Icon, Image02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { useMessages } from "#/hooks/use-messages";
import { AVATAR_MAX_BYTES, AVATAR_SIZE } from "#/lib/avatar";
import { cn } from "#/lib/utils";
import { removeAvatarFn, uploadAvatarFn } from "#/server/profile";
import { AvatarCropper } from "./avatar-cropper";
import { type Crop, decodeImage, encodeAvatar, initialCrop } from "./avatar-dialog.crop";

/** A picked file bigger than this is refused before decoding; the upload itself is the cropped, re-encoded result. */
const MAX_PICK_BYTES = 25_000_000;

/**
 * The owner's edit-avatar button (a camera on the avatar) and the dialog it
 * opens: pick a photo, frame it, save. `onChanged` runs after a save or a
 * removal, so the page can read the profile and the session again.
 */
export function AvatarEditButton({ image, name, onChanged }: { image: string | null; name: string; onChanged: () => void | Promise<void> }) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        aria-label={m.profile.avatar.edit}
        // The ::after widens the touch target past the 40px visible button
        className="relative size-10 rounded-full shadow-md ring-[3px] ring-card after:absolute after:-inset-1 after:content-['']"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Camera01Icon} className="size-5" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !(busy && !next) && setOpen(next)}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <AvatarDialogBody image={image} name={name} onClose={() => setOpen(false)} onChanged={onChanged} onBusyChange={setBusy} />
        </DialogContent>
      </Dialog>
    </>
  );
}

type Step = "pick" | "crop";

/** Lives only while the dialog is open, so every opening starts from the first step. */
function AvatarDialogBody({
  image,
  name,
  onClose,
  onChanged,
  onBusyChange,
}: {
  image: string | null;
  name: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const m = useMessages();
  const t = m.profile.avatar;
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [reading, setReading] = useState(false);
  const [working, setWorking] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = reading || working !== null;

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  // A decoded bitmap holds its pixels until closed
  useEffect(() => () => bitmap?.close(), [bitmap]);

  const fail = (err: unknown) => setError(t.errors[err instanceof Error ? err.message : ""] ?? t.errors.generic);

  const choose = async (file: File | undefined) => {
    if (!file || busy) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t.errors["not-an-image"]);
    if (file.size > MAX_PICK_BYTES) return setError(t.errors["file-too-big"]);
    setReading(true);
    try {
      const next = await decodeImage(file);
      setBitmap(next);
      setCrop(initialCrop(next));
      setStep("crop");
    } catch {
      setError(t.errors["not-an-image"]);
    } finally {
      setReading(false);
    }
  };

  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void choose(e.dataTransfer.files[0]);
  };

  const finish = () => {
    // The page refreshes the profile and session in the background; the dialog need not wait
    void Promise.resolve(onChanged()).catch(() => {});
    onClose();
  };

  const save = async () => {
    if (!bitmap || !crop) return;
    setError(null);
    setWorking("save");
    try {
      const file = await encodeAvatar(bitmap, crop, AVATAR_SIZE, AVATAR_MAX_BYTES);
      const body = new FormData();
      body.append("file", file);
      await uploadAvatarFn({ data: body });
      finish();
    } catch (err) {
      fail(err);
      setWorking(null);
    }
  };

  const remove = async () => {
    setError(null);
    setWorking("remove");
    try {
      await removeAvatarFn();
      finish();
    } catch (err) {
      fail(err);
      setWorking(null);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">{t.title}</DialogTitle>
        <DialogDescription>{step === "pick" ? t.pickHint : t.cropHint}</DialogDescription>
      </DialogHeader>

      {step === "pick" || !bitmap || !crop ? (
        <div className="grid gap-3">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target is a pointer-only convenience; the Choose button inside is the keyboard path */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={cn(
              "mx-auto grid aspect-square w-full max-w-72 place-content-center justify-items-center gap-3 rounded-3xl border-2 border-dashed p-4 text-center motion-safe:transition-colors",
              dragging ? "border-primary bg-primary/10" : "border-border bg-muted/40",
            )}
          >
            <Avatar className="size-24">
              {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback className="text-3xl font-bold">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground pointer-coarse:hidden">{dragging ? t.dropActive : t.dropHere}</p>
            <Button type="button" className="h-10 rounded-full px-5" disabled={busy} onClick={() => fileInput.current?.click()}>
              <HugeiconsIcon icon={Image02Icon} data-icon="inline-start" />
              {reading ? t.reading : t.choose}
            </Button>
            <p className="text-xs text-muted-foreground">{t.formats}</p>
            <Input
              ref={fileInput}
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // picking the same file again must still fire
                void choose(file);
              }}
            />
          </div>
          <div className="mx-auto flex h-9 w-full max-w-72 items-center justify-center">
            {image && (
              <Button type="button" variant="destructive" className="h-9 rounded-full px-4" disabled={busy} onClick={() => void remove()}>
                <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
                {working === "remove" ? t.removing : t.remove}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <AvatarCropper bitmap={bitmap} crop={crop} onChange={setCrop} disabled={busy} />
      )}

      {/* Always in the layout, so an error appearing never moves the buttons */}
      <p role="alert" className="min-h-5 text-center text-sm text-destructive">
        {error}
      </p>

      <DialogFooter className="sm:justify-center">
        {step === "crop" ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-full px-6"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep("pick");
              }}
            >
              {t.back}
            </Button>
            <Button type="button" className="h-11 rounded-full px-6" disabled={busy} aria-busy={working === "save"} onClick={() => void save()}>
              {working === "save" ? t.saving : t.save}
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" className="h-11 rounded-full px-6" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
