import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { findSaveRules } from "@web-games/games/saves";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { saveScore } from "#/server/db/leaderboard";
import {
  deleteSave,
  listSaves,
  readSave,
  writeSave,
} from "#/server/db/saves";

// Boundary: client-callable server functions and types only (layout rule D).

export type { StoredSave, WriteResult } from "#/server/db/saves";

/** Only games that keep progress on the account, and ship save rules. */
const slug = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/)
  .refine(
    (s) =>
      findGame(s)?.requiresAccount === true && findSaveRules(s) !== undefined,
    "Not an account game",
  );

/** A slot number the game actually has (`saveSlots`, default 1). */
const slotOf = (gameSlug: string, slot: number) => {
  const slots = findGame(gameSlug)?.saveSlots ?? 1;
  if (!Number.isInteger(slot) || slot < 0 || slot >= slots)
    throw new Error("No such save slot");
  return slot;
};

/** A real save is a few KB; anything far bigger is not one. */
const MAX_BYTES = 64 * 1024;

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function signedInUser() {
  const user = await currentUser(getRequestHeaders() as unknown as Headers);
  if (!user) throw new Error("Cần đăng nhập để lưu tiến trình");
  return user;
}

const slotNo = z.number().int().min(0).max(9);

export const loadGameSave = createServerFn({ method: "GET" })
  .validator(z.object({ slug, slot: slotNo }))
  .handler(async ({ data }) => {
    const user = await signedInUser();
    return readSave(
      getDb(),
      user.id,
      data.slug,
      slotOf(data.slug, data.slot),
    );
  });

/** The player's saves for a game, one entry per filled slot. */
export const listGameSaves = createServerFn({ method: "GET" })
  .validator(z.object({ slug }))
  .handler(async ({ data }) => {
    const user = await signedInUser();
    return listSaves(getDb(), user.id, data.slug);
  });

/** Start a slot over. The leaderboard keeps the player's best regardless. */
export const deleteGameSave = createServerFn({ method: "POST" })
  .validator(z.object({ slug, slot: slotNo }))
  .handler(async ({ data }) => {
    const user = await signedInUser();
    await deleteSave(getDb(), user.id, data.slug, slotOf(data.slug, data.slot));
    return { ok: true as const };
  });

/**
 * Store the player's save if it is well-formed and could follow the stored one
 * (the game's own rules), and the slot is still at `version`. With `detail`, the
 * day's result also goes on the leaderboard, scored from the save itself.
 */
export const storeGameSave = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug,
      slot: slotNo,
      /** The game's save as JSON text. */
      json: z.string().max(MAX_BYTES),
      version: z.number().int().min(0),
      detail: z.string().max(40).optional(),
    }),
  )
  .handler(async ({ data: input }) => {
    const user = await signedInUser();
    const rules = findSaveRules(input.slug);
    if (!rules) throw new Error("Not an account game");
    const next = rules.parse(parseJson(input.json));
    if (!next) throw new Error("Malformed save");
    const slot = slotOf(input.slug, input.slot);
    const db = getDb();
    const stored = await readSave(db, user.id, input.slug, slot);
    if (
      !rules.plausible(
        stored ? rules.parse(parseJson(stored.json)) : null,
        next,
      )
    )
      throw new Error("Implausible save");
    const result = await writeSave(db, {
      userId: user.id,
      gameSlug: input.slug,
      slot,
      json: JSON.stringify(next),
      expected: input.version,
    });
    if (result.ok && input.detail !== undefined && rules.score) {
      const score = Math.round(rules.score(next));
      if (score > 0) {
        await saveScore(db, {
          gameSlug: input.slug,
          score,
          detail: input.detail,
          name: user.name.slice(0, 20),
          userId: user.id,
        });
      }
    }
    return result;
  });
