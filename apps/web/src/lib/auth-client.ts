import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

// Framework-free Better Auth client (same origin as the page). React code reads
// the session through hooks/use-session; actions are plain functions here.

export const authClient = createAuthClient({
  // The SPA shell is prerendered on the server, where there is no `window`
  baseURL: typeof window === "undefined" ? "http://localhost" : window.location.origin,
  // Mirrors the server's user.additionalFields so `user.locale` is typed here
  plugins: [inferAdditionalFields({ user: { locale: { type: "string", required: false } } })],
});

/** Full-page redirect to Google; comes back to `returnTo` signed in. */
export function signInWithGoogle(returnTo = window.location.pathname) {
  return authClient.signIn.social({ provider: "google", callbackURL: returnTo });
}

export function signOut() {
  return authClient.signOut();
}
