import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { depositTickets, getTicketBalance } from "#/server/db/tickets";

// Boundary: client-callable server functions and types only (layout rule D).
// See docs/standards/tickets.md.

export type { DepositResult, TicketBalance } from "#/server/db/tickets";

/**
 * Earn tickets in a game with `manifest.tickets`, for the signed-in player. Over
 * a cap, the deposit is clamped (never dropped): `accepted` is what went in and
 * `clamped` says why it is less. The portal must not offer this inside an
 * online match.
 */
export const depositTicketsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z
        .string()
        .refine((s) => findGame(s)?.tickets === true, "Game takes no tickets"),
      // Over MAX_DEPOSIT is allowed through: it is clamped and reported, not refused
      amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    return depositTickets(getDb(), {
      userId: user.id,
      slug: data.slug,
      tickets: findGame(data.slug)?.tickets,
      amount: data.amount,
      now: Date.now(),
    });
  });

/** The signed-in player's wallet, or null when nobody is signed in. */
export const getTicketBalanceFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) return null;
    return getTicketBalance(getDb(), user.id);
  },
);
