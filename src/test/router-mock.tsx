// Test double for @tanstack/react-router: route modules keep their real options, while hooks read
// from a mutable `routerState` that each test controls.
import type { ReactNode } from "react";
import { vi } from "vitest";

type Config = { convexUrl: string; environment: string; release: string; emailDelivery: boolean };

export const routerState = {
  search: {} as Record<string, unknown>,
  params: {} as Record<string, string>,
  context: {
    config: { convexUrl: "https://api.example.test", environment: "test", release: "abc123", emailDelivery: true } as Config,
    isAuthenticated: false,
  },
  navigate: vi.fn(async () => undefined),
};

export function resetRouter() {
  routerState.search = {};
  routerState.params = {};
  routerState.context.config = { convexUrl: "https://api.example.test", environment: "test", release: "abc123", emailDelivery: true };
  routerState.context.isAuthenticated = false;
  routerState.navigate.mockReset();
  routerState.navigate.mockResolvedValue(undefined);
}

function makeRoute(id: string) {
  return (options: Record<string, unknown>) => ({
    id,
    fullPath: id,
    options,
    useSearch: () => routerState.search,
    useParams: () => routerState.params,
  });
}

export const createFileRoute = (path: string) => makeRoute(path);
export const createRootRouteWithContext = () => makeRoute("__root__");
export const useNavigate = () => routerState.navigate;
export const useRouteContext = () => routerState.context;
export const redirect = (options: unknown) => ({ isRedirect: true, options });
export const Outlet = () => null;
export const HeadContent = () => null;
export const Scripts = () => null;

export function Link({
  to,
  params,
  search,
  children,
  className,
  ...rest
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  let href = to;
  for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
  const query = new URLSearchParams(search ?? {}).toString();
  return (
    <a href={query ? `${href}?${query}` : href} className={className} aria-label={rest["aria-label"] as string | undefined}>
      {children}
    </a>
  );
}
