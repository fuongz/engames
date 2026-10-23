import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/server/auth";

// Better Auth's endpoints (/api/auth/sign-in/social, /callback/google, /get-session,
// /sign-out, …) are all served by its own handler.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => getAuth().handler(request),
      POST: ({ request }) => getAuth().handler(request),
    },
  },
});
