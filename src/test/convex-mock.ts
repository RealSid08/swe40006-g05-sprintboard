// Test double for convex/react. Queries resolve from a map keyed by function name.
import { getFunctionName, type FunctionReference } from "convex/server";
import { vi, type Mock } from "vitest";

type MutationMock = Mock<(args: unknown) => Promise<unknown>>;

export const convexState = {
  authenticated: true,
  results: new Map<string, unknown>(),
  queryArgs: new Map<string, unknown>(),
  mutations: new Map<string, MutationMock>(),
};

export function resetConvex() {
  convexState.authenticated = true;
  convexState.results.clear();
  convexState.queryArgs.clear();
  convexState.mutations.clear();
}

export function mutationMock(name: string): MutationMock {
  let mock = convexState.mutations.get(name);
  if (!mock) {
    mock = vi.fn<(args: unknown) => Promise<unknown>>(async () => null);
    convexState.mutations.set(name, mock);
  }
  return mock;
}

export const useConvexAuth = () => ({ isLoading: false, isAuthenticated: convexState.authenticated });

export function useQuery(query: FunctionReference<"query">, args?: unknown) {
  const name = getFunctionName(query);
  if (args === "skip") return undefined;
  convexState.queryArgs.set(name, args);
  return convexState.results.get(name);
}

export function useMutation(mutation: FunctionReference<"mutation">) {
  const name = getFunctionName(mutation);
  const fn = (args: unknown) => mutationMock(name)(args);
  return Object.assign(fn, { withOptimisticUpdate: () => fn });
}
