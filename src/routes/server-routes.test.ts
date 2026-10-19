import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => import("~/test/router-mock"));
const handler = vi.fn(async () => new Response("auth"));
const getToken = vi.fn(async (): Promise<string | undefined> => "jwt");
vi.mock("~/lib/auth-server", () => ({ authServer: () => ({ handler, getToken }) }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (fn: () => unknown) => fn }),
  createIsomorphicFn: () => ({ server: () => ({ client: (fn: () => unknown) => fn }) }),
}));

type Handlers = Record<string, (ctx: { request: Request }) => Promise<Response> | Response>;
type ServerRoute = { options: { server: { handlers: Handlers } } };
const load = async (path: string) => ((await import(path)) as { Route: ServerRoute }).Route.options.server.handlers;

const env = { CONVEX_URL: "https://api.example.test", CONVEX_SITE_URL: "https://auth.example.test", APP_RELEASE: "sha" };

beforeEach(() => {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
});

describe("server routes", () => {
  it("serve liveness on /health and /api/health", async () => {
    for (const path of ["./health", "./api/health"]) {
      const handlers = await load(path);
      const body = await (await handlers.GET!({ request: new Request("https://app.example.test/") })).json();
      expect(body).toMatchObject({ ok: true, release: "sha" });
    }
  });

  it("serve readiness on /ready and /api/ready", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ ok: true, mode: "read" }));
    for (const path of ["./ready", "./api/ready"]) {
      const handlers = await load(path);
      const response = await handlers.GET!({ request: new Request("https://app.example.test/api/ready") });
      expect(response.status).toBe(200);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("proxy auth requests to the backend", async () => {
    const handlers = await load("./api/auth/$");
    const request = new Request("https://app.example.test/api/auth/get-session");
    await handlers.GET!({ request });
    await handlers.POST!({ request });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("root route authenticates SSR queries with the session token", async () => {
    type Root = { options: { beforeLoad: (o: unknown) => Promise<{ isAuthenticated: boolean; token: string | null }> } };
    const { Route } = (await import("./__root")) as unknown as { Route: Root };
    const setAuth = vi.fn();
    const context = { convexQueryClient: { serverHttpClient: { setAuth } } };
    await expect(Route.options.beforeLoad({ context })).resolves.toEqual({ isAuthenticated: true, token: "jwt" });
    expect(setAuth).toHaveBeenCalledWith("jwt");
    getToken.mockResolvedValueOnce(undefined);
    await expect(Route.options.beforeLoad({ context })).resolves.toEqual({ isAuthenticated: false, token: null });
  });
});
