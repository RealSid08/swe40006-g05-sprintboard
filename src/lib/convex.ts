import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReference, OptionalRestArgs } from "convex/server";

/**
 * `useQuery` for signed-in pages. Waits until the Convex client has applied the session token,
 * so a reload or token refresh never runs a protected query anonymously (which would throw
 * UNAUTHENTICATED into the error boundary). Pass "skip" to disable the query.
 */
export function useAuthedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgs<Query> | ["skip"]
): Query["_returnType"] | undefined {
  const { isAuthenticated } = useConvexAuth();
  const queryArgs = (isAuthenticated ? args : ["skip"]) as OptionalRestArgs<Query>;
  return useQuery(query, ...queryArgs);
}
