import { useSyncExternalStore } from "react";
import { authClient } from "#/lib/auth-client";

type SessionState = ReturnType<typeof authClient.useSession.get>;

/** While prerendering the shell there is no session yet; treat it as loading. */
const SERVER_STATE = { data: null, error: null, isPending: true, isRefetching: false } as unknown as SessionState;

const subscribe = (onChange: () => void) => authClient.useSession.listen(onChange);
const getSnapshot = () => authClient.useSession.get();
const getServerSnapshot = () => SERVER_STATE;

/** Current Better Auth session: `{ data: { user, session } | null, isPending }`. */
export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
