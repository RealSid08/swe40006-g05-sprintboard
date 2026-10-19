import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { errorMessage, isNotFound } from "./errors";

describe("errors", () => {
  it("extracts user-facing messages", () => {
    expect(errorMessage(new ConvexError("Plain text"))).toBe("Plain text");
    expect(errorMessage(new ConvexError({ code: "FORBIDDEN", message: "Owners only" }))).toBe("Owners only");
    expect(errorMessage(new Error("Network down"))).toBe("Network down");
    expect(errorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(errorMessage({}, "Fallback")).toBe("Fallback");
  });

  it("recognises not-found errors", () => {
    expect(isNotFound(new ConvexError({ code: "NOT_FOUND", message: "x" }))).toBe(true);
    expect(isNotFound(new ConvexError({ code: "FORBIDDEN", message: "x" }))).toBe(false);
    expect(isNotFound(new Error("NOT_FOUND"))).toBe(false);
  });
});
