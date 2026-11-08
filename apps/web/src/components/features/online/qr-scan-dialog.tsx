import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { useMessages } from "#/hooks/use-messages";
import { roomFromQr } from "#/lib/online";

/**
 * The camera, looking for a room's QR code. The scanner library (and its
 * worker) loads only when the dialog opens; the camera stops when it closes.
 */
export function QrScanDialog({
  open,
  onOpenChange,
  slug,
  onRoom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The game being joined, for a QR code that holds a bare room code. */
  slug: string;
  onRoom: (room: { slug: string; code: string }) => void;
}) {
  const m = useMessages();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(onRoom);
  done.current = onRoom;

  useEffect(() => {
    if (!open) return;
    setError(null);
    let alive = true;
    let stop = () => {};
    // The <video> mounts with the dialog's content, a frame after `open`
    const start = window.setTimeout(async () => {
      const el = video.current;
      if (!el) return;
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (!alive) return;
        let lastBad = "";
        const scanner = new QrScanner(
          el,
          (result) => {
            const room = roomFromQr(result.data, slug);
            if (room) {
              scanner.stop();
              done.current(room);
            } else if (result.data !== lastBad) {
              lastBad = result.data;
              setError(m.online.scanNotRoom);
            }
          },
          { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
        );
        stop = () => scanner.destroy();
        await scanner.start();
      } catch {
        if (alive) setError(m.online.scanNoCamera);
      }
    }, 50);
    return () => {
      alive = false;
      window.clearTimeout(start);
      stop();
    };
  }, [open, slug, m]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{m.online.scanTitle}</DialogTitle>
          <DialogDescription>{m.online.scanHint}</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
          {/* muted + playsInline: iOS only plays an inline camera stream that way */}
          <video ref={video} muted playsInline className="size-full object-cover" />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
