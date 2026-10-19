import { describe, expect, test } from "vitest";
import { normalizeEmail, optionalText, parseDueDate, requireText } from "./validation";

describe("validation", () => {
  test("requireText trims and enforces bounds", () => {
    expect(requireText("  hi  ", "Title", 5)).toBe("hi");
    expect(() => requireText(" ", "Title", 5)).toThrow();
    expect(() => requireText("toolong", "Title", 5)).toThrow();
  });

  test("optionalText allows empty values", () => {
    expect(optionalText("  ", "Description", 5)).toBe("");
    expect(() => optionalText("toolong", "Description", 5)).toThrow();
  });

  test("parseDueDate accepts real dates only", () => {
    expect(parseDueDate(null)).toBeNull();
    expect(parseDueDate(" ")).toBeNull();
    expect(parseDueDate("2028-02-29")).toBe("2028-02-29");
    for (const bad of ["2027-02-29", "2026-13-01", "2026-1-1", "tomorrow"]) {
      expect(() => parseDueDate(bad)).toThrow();
    }
  });

  test("normalizeEmail lowercases and validates", () => {
    expect(normalizeEmail(" A@B.Co ")).toBe("a@b.co");
    expect(() => normalizeEmail("a@b")).toThrow();
    expect(() => normalizeEmail(`${"a".repeat(250)}@b.co`)).toThrow();
  });
});
