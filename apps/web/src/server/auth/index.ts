import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { LOCALES } from "@web-games/core/i18n";
import { z } from "zod";
import { getDb, schema } from "#/server/db";

// SERVER-ONLY (in `serverOnly`). Sign-in exists for one reason: to put a real
// name on the leaderboard without typing it every time. Google is the only
// provider; there are no passwords.

/** Built per request for the same reason as getDb(): `env` is request-scoped. */
export function getAuth() {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    user: {
      // The UI language follows the account across devices (stores/locale syncs it)
      additionalFields: {
        locale: { type: "string", required: false, validator: { input: z.enum(LOCALES) } },
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 60, // 60 days: players shouldn't have to sign in often
      // Signed cookie cache: most getSession calls skip the D1 round trip
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  });
}

/** The signed-in user for the current request, or null. */
export async function currentUser(headers: Headers) {
  const result = await getAuth().api.getSession({ headers });
  return result?.user ?? null;
}
