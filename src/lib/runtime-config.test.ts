import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createIsomorphicFn: () => ({ server: () => ({ client: (fn: () => unknown) => fn }) }),
}));

const { CONFIG_GLOBAL, configScript, getPublicConfig, readBrowserConfig, readServerConfig } = await import("./runtime-config");

describe("runtime config", () => {
  it("reads public config from the environment at request time", () => {
    expect(
      readServerConfig({ CONVEX_URL: "https://api.example.test", APP_ENVIRONMENT: "staging", APP_RELEASE: "abc" }),
    ).toEqual({ convexUrl: "https://api.example.test", environment: "staging", release: "abc", emailDelivery: true });
  });

  it("falls back to RELEASE_SHA and defaults", () => {
    expect(readServerConfig({ CONVEX_URL: "https://api.example.test", RELEASE_SHA: "def" })).toMatchObject({
      environment: "local",
      release: "def",
    });
    expect(readServerConfig({ CONVEX_URL: "https://api.example.test" }).release).toBe("unreleased");
  });

  it("reports when email delivery is disabled for the demo deployment", () => {
    expect(readServerConfig({ CONVEX_URL: "https://api.example.test", EMAIL_TRANSPORT: "disabled" }).emailDelivery).toBe(false);
  });

  it("fails clearly without a Convex URL", () => {
    expect(() => readServerConfig({})).toThrow(/CONVEX_URL must be set/);
    expect(() => readServerConfig({ CONVEX_URL: "not a url" })).toThrow(/CONVEX_URL/);
  });

  it("embeds config safely in an inline script and reads it back in the browser", () => {
    const config = { convexUrl: "https://api.example.test", environment: "x</script>", release: "r", emailDelivery: true };
    const script = configScript(config);
    expect(script).not.toContain("</script>");
    expect(script.startsWith(`window.${CONFIG_GLOBAL}=`)).toBe(true);
    new Function(script)();
    expect(readBrowserConfig(window[CONFIG_GLOBAL])).toEqual(config);
    expect(getPublicConfig()).toEqual(config);
    expect(() => readBrowserConfig({})).toThrow();
  });
});
