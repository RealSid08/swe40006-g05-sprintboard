import { createIsomorphicFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public runtime configuration. Read from process environment on the server at request
 * time and embedded in the HTML for the browser, so one built image serves any environment.
 */
export const publicConfigSchema = z.object({
  convexUrl: z.url(),
  environment: z.string().min(1),
  release: z.string().min(1),
  /** False when the deployment drops outgoing email (EMAIL_TRANSPORT=disabled), e.g. the demo production. */
  emailDelivery: z.boolean().default(true),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const CONFIG_GLOBAL = "__SPRINTBOARD_CONFIG__";

declare global {
  interface Window {
    [CONFIG_GLOBAL]?: unknown;
  }
}

export function readServerConfig(env: Record<string, string | undefined>): PublicConfig {
  const parsed = publicConfigSchema.safeParse({
    convexUrl: env.CONVEX_URL,
    environment: env.APP_ENVIRONMENT ?? "local",
    release: env.APP_RELEASE ?? env.RELEASE_SHA ?? "unreleased",
    emailDelivery: env.EMAIL_TRANSPORT !== "disabled",
  });
  if (!parsed.success) {
    throw new Error(
      "CONVEX_URL must be set to the public Convex URL for this environment (see docs/runtime-config.md).",
    );
  }
  return parsed.data;
}

export function readBrowserConfig(value: unknown): PublicConfig {
  return publicConfigSchema.parse(value);
}

export const getPublicConfig = createIsomorphicFn()
  .server(() => readServerConfig(process.env))
  .client(() => readBrowserConfig(window[CONFIG_GLOBAL]));

/** Inline script content; `<` is escaped so the JSON cannot close the script element. */
export function configScript(config: PublicConfig): string {
  return `window.${CONFIG_GLOBAL}=${JSON.stringify(config).replaceAll("<", "\\u003c")};`;
}
