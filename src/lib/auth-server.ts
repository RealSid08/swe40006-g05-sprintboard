import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set (see docs/runtime-config.md).`);
  return value;
}

let instance: ReturnType<typeof convexBetterAuthReactStart> | undefined;

/**
 * Server-only Better Auth helpers. Created lazily so the environment is read at runtime.
 * CONVEX_INTERNAL_URL / CONVEX_SITE_URL may point at a private network address.
 */
export function authServer() {
  instance ??= convexBetterAuthReactStart({
    convexUrl: process.env.CONVEX_INTERNAL_URL ?? required("CONVEX_URL"),
    convexSiteUrl: required("CONVEX_SITE_URL"),
  });
  return instance;
}
