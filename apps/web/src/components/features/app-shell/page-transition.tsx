import { useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { EASE_OUT } from "#/lib/motion";

const HIDDEN = { opacity: 0, transform: "translateY(8px)" };
// `transform: none` once settled: a leftover transform would become the
// containing block for every `position: fixed` descendant.
const SHOWN = { opacity: 1, transform: "translateY(0px)", transitionEnd: { transform: "none" } };

/**
 * Bridges route changes: the new page rises 8px into place over 200ms, short
 * enough not to slow navigation down. The first paint never animates (the
 * prerendered HTML must arrive visible), and the game player opts out — it is
 * `position: fixed` on phones, which a transform on an ancestor would break.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);
  const still = firstPaint.current || path.startsWith("/games/");

  return (
    <motion.div key={path} initial={still ? false : HIDDEN} animate={SHOWN} transition={{ duration: 0.2, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}
