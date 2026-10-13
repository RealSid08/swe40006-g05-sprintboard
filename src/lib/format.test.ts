import { describe, expect, it } from "vitest";
import { avatarTone, dueState, formatDue, initials, relativeTime, todayIso } from "./format";

describe("format helpers", () => {
  it("builds initials from names", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  cher ")).toBe("C");
    expect(initials("Mary Ann Smith")).toBe("MS");
    expect(initials("")).toBe("?");
  });

  it("gives each person a stable avatar colour", () => {
    expect(avatarTone("u1")).toBe(avatarTone("u1"));
    expect(avatarTone("u1")).toMatch(/^bg-/);
  });

  it("describes elapsed time", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(relativeTime(now - 10_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(relativeTime(Date.parse("2026-09-01T12:00:00Z"), now)).toMatch(/Sep/);
  });

  it("formats the local calendar date", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("classifies and labels due dates", () => {
    const today = "2026-10-20";
    expect(dueState("2026-10-19", today)).toBe("overdue");
    expect(dueState(today, today)).toBe("today");
    expect(dueState("2026-10-22", today)).toBe("soon");
    expect(dueState("2026-11-30", today)).toBe("later");
    expect(formatDue(today, today)).toBe("Due today");
    expect(formatDue("2026-10-19", today)).toMatch(/^Overdue, 19 Oct/);
    expect(formatDue("2026-11-30", today)).toMatch(/^Due 30 Nov/);
  });
});
