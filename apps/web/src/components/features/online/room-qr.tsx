import { useEffect, useState } from "react";
import { cn } from "#/lib/utils";

/**
 * A QR code for `url`, drawn as one SVG path. The encoder is loaded on first use
 * (tech-stack.md: heavy, rarely-used packages behind a dynamic import).
 */
export function RoomQr({ url, label, className }: { url: string; label: string; className?: string }) {
  const [path, setPath] = useState<{ d: string; size: number } | null>(null);
  useEffect(() => {
    let alive = true;
    void import("uqr").then(({ encode }) => {
      if (!alive) return;
      const { data, size } = encode(url, { ecc: "M", border: 2 });
      let d = "";
      data.forEach((row, y) => {
        row.forEach((dark, x) => {
          if (dark) d += `M${x} ${y}h1v1h-1z`;
        });
      });
      setPath({ d, size });
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    // Always dark on white, whatever the theme: scanners need the contrast
    <div className={cn("bg-white text-black", className)}>
      {path ? (
        <svg viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label={label} className="block size-full" shapeRendering="crispEdges">
          <path d={path.d} fill="currentColor" />
        </svg>
      ) : (
        <div className="size-full animate-pulse" aria-hidden />
      )}
    </div>
  );
}
