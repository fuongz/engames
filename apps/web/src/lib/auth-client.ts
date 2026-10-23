import { createAuthClient } from "better-auth/client";

// Framework-free Better Auth client (same origin as the page). React code reads
// the session through hooks/use-session; actions are plain functions here.

export const authClient = createAuthClient({
  // The SPA shell is prerendered on the server, where there is no `window`
  baseURL: typeof window === "undefined" ? "http://localhost" : window.location.origin,
});

/** Full-page redirect to Google; comes back to `returnTo` signed in. */
export function signInWithGoogle(returnTo = window.location.pathname) {
  return authClient.signIn.social({ provider: "google", callbackURL: returnTo });
}

export function signOut() {
  return authClient.signOut();
}
