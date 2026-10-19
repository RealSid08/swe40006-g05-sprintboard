/// <reference types="vite/client" />
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ComponentProps, ReactNode } from "react";
import { Toaster } from "sonner";
import { authClient } from "~/lib/auth-client";
import { authServer } from "~/lib/auth-server";
import { configScript, type PublicConfig } from "~/lib/runtime-config";
import appCss from "~/styles/app.css?url";

const getAuthToken = createServerFn({ method: "GET" }).handler(async () => {
  return (await authServer().getToken()) ?? null;
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  config: PublicConfig;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SprintBoard" },
      { name: "description", content: "Plan, assign and track team tasks on a shared board." },
      { name: "theme-color", content: "#f6f5f1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const token = await getAuthToken();
    if (token) {
      // Only present during SSR: authenticate server-side HTTP queries.
      context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return { isAuthenticated: token !== null, token };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });
  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient as unknown as ComponentProps<typeof ConvexBetterAuthProvider>["authClient"]}
      initialToken={context.token}
    >
      <RootDocument config={context.config}>
        <Outlet />
      </RootDocument>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children, config }: { children: ReactNode; config: PublicConfig }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: configScript(config) }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
        <Scripts />
      </body>
    </html>
  );
}
