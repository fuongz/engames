import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "#/server/db";
import { acceptResults } from "#/server/online/results";

// The realtime Worker posts each finished online match here (HMAC-signed);
// signed-in players' scores land on the "<slug>:coop" board.
export const Route = createFileRoute("/api/online/results")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const outcome = await acceptResults(getDb(), await request.text(), request.headers.get("x-signature"));
        return Response.json(outcome, { status: outcome.status });
      },
    },
  },
});
