import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirect("/projects/abc?status=done")).toBe("/projects/abc?status=done");
  });
  it.each([undefined, 42, "https://evil.example", "//evil.example", "/\\evil", "/api/auth/sign-out", "projects"])(
    "falls back for %s",
    (value) => {
      expect(safeRedirect(value)).toBe("/projects");
    },
  );
});
