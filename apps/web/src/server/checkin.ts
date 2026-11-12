import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { claimCheckin, readCheckin } from "#/server/db/checkin";

// Boundary: client-callable server functions and types only (layout rule D).
// See docs/standards/checkin.md.

export type { CheckinClaim, CheckinDay, CheckinState, NextMilestone } from "#/server/db/checkin";
export type { CheckinMilestone } from "#/lib/checkin";

const signedIn = () => currentUser(getRequestHeaders() as unknown as Headers);

/**
 * Check the signed-in player in for today (Vietnam day) and pay the cycle's
 * tickets into the shared wallet, plus a one-time milestone bonus at 7, 30 and
 * 100 days. Idempotent per day: a second call returns `claimed: false`. The
 * week's shield covers one missed day on its own. Throws `sign-in-required`.
 */
export const claimCheckinFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await signedIn();
  if (!user) throw new Error("sign-in-required");
  return claimCheckin(getDb(), user.id, Date.now());
});

/** The signed-in player's check-in calendar, streak and shield. Throws `sign-in-required`. */
export const getCheckinFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await signedIn();
  if (!user) throw new Error("sign-in-required");
  return readCheckin(getDb(), user.id, Date.now());
});
