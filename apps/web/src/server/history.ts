import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { consentOf, historyFor, setConsent } from "#/server/db/history";

// Boundary: client-callable server functions and types only (layout rule D).

export type { HistoryEntry, Outcome } from "#/server/db/history";

const signedIn = () => currentUser(getRequestHeaders() as unknown as Headers);

/** Whether the signed-in player keeps their online match history: true/false, or null if never asked (or signed out). */
export const getHistoryConsent = createServerFn({ method: "GET" }).handler(async () => {
  const user = await signedIn();
  return user ? consentOf(getDb(), user.id) : null;
});

export const setHistoryConsent = createServerFn({ method: "POST" })
  .validator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await signedIn();
    if (!user) throw new Error("sign-in-required");
    await setConsent(getDb(), user.id, data.enabled);
    return data.enabled;
  });

/** The signed-in player's saved matches, newest first. */
export const getMatchHistory = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().int().min(1).max(50).default(20), before: z.number().int().positive().optional() }))
  .handler(async ({ data }) => {
    const user = await signedIn();
    if (!user) return null;
    return historyFor(getDb(), user.id, data.limit, data.before);
  });
