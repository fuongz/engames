import { cn } from "#/lib/utils";

/**
 * The arcade ticket as a picture (`/profile/ticket.webp`), decorative only: the
 * text next to it carries the meaning. Size it with a `size-*` class; the
 * width/height attributes only reserve the box before the image decodes.
 */
export function TicketIcon({ px = 16, className }: { px?: number; className?: string }) {
  return (
    <img
      src="/profile/ticket.webp"
      alt=""
      aria-hidden
      width={px}
      height={px}
      decoding="async"
      draggable={false}
      className={cn("shrink-0 object-contain select-none", className)}
    />
  );
}
