/**
 * Resolves where to send the user after sign-in / sign-up from `location.state`.
 * `PrivateRoute` stores `from` as a single path string for reliable history serialization.
 * Older navigations may still pass `{ from: Location }` — those are supported for compatibility.
 */
export type SignInLocationState = {
  from?:
    | string
    | {
        pathname: string;
        search?: string;
        hash?: string;
      };
};

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function getPostAuthRedirectPath(state: unknown): string {
  if (state == null || typeof state !== "object") return "/dashboard";
  const from = (state as SignInLocationState).from;
  if (typeof from === "string" && from.length > 0) {
    if (from === "/signin" || from === "/signup") return "/dashboard";
    return isSafeInternalPath(from) ? from : "/dashboard";
  }
  if (from && typeof from === "object" && typeof from.pathname === "string") {
    if (from.pathname === "/signin" || from.pathname === "/signup") return "/dashboard";
    const built = `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
    return isSafeInternalPath(built) ? built : "/dashboard";
  }
  return "/dashboard";
}
