import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findOnlineGame, isRoomCode } from "@web-games/games/online";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { issueTicket, newRoomCode } from "#/server/online/tickets";

// Boundary: client-callable server functions and types only (layout rule D).

export interface OnlineTicket {
  code: string;
  ticket: string;
  /** The name the room will show. */
  name: string;
}

const playerName = z
  .string()
  .transform((s) =>
    s
      .normalize("NFC")
      .replace(/\p{C}/gu, "")
      .replace(/\s+/g, " ")
      .trim(),
  )
  .pipe(z.string().min(2).max(20));

/**
 * A 60-second ticket to take a seat in a room (a new one when `code` is
 * omitted). Signed-in players use their account; guests bring a name and the
 * random id their browser keeps, so a refresh rejoins the same seat.
 */
export const createOnlineTicket = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().refine((s) => findOnlineGame(s) !== undefined, "Not an online game"),
      code: z.string().refine(isRoomCode, "Bad room code").optional(),
      name: playerName.optional(),
      guestId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{8,40}$/)
        .optional(),
    }),
  )
  .handler(async ({ data }): Promise<OnlineTicket> => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    const code = data.code ?? newRoomCode();
    if (user) {
      const name = (user.name || "Player").slice(0, 20);
      return { code, name, ticket: await issueTicket({ slug: data.slug, code, playerId: user.id, name, userId: user.id }) };
    }
    if (!data.name || !data.guestId) throw new Error("guest-needs-name");
    return {
      code,
      name: data.name,
      ticket: await issueTicket({ slug: data.slug, code, playerId: `guest:${data.guestId}`, name: data.name, userId: null }),
    };
  });
