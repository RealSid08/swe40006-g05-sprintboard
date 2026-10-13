import { describe, expect, it } from "vitest";
import { makeTask, member } from "~/test/fixtures";
import { applyFilterPatch, boardSearchSchema, groupByStatus, hasFilters, moveTaskInList, toQueryFilters, visibleColumns } from "./board";

describe("board search", () => {
  it("parses valid filters and drops invalid values instead of failing", () => {
    expect(boardSearchSchema.parse({ status: "review", priority: "urgent", assignee: "u1" })).toEqual({
      status: "review",
      priority: "urgent",
      assignee: "u1",
    });
    expect(boardSearchSchema.parse({ status: "nope", priority: 4, assignee: "" })).toEqual({});
  });

  it("detects active filters", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ priority: "low" })).toBe(true);
  });

  it("maps URL filters to query arguments and ignores non-member assignees", () => {
    const members = new Set<string>([member.userId]);
    expect(toQueryFilters({ status: "done", priority: "high", assignee: member.userId }, members)).toEqual({
      status: "done",
      priority: "high",
      assignee: member.userId,
    });
    expect(toQueryFilters({ assignee: "unassigned" }, members)).toEqual({ assignee: "unassigned" });
    expect(toQueryFilters({ assignee: "someone-else" }, members)).toEqual({});
  });

  it("merges filter patches and clears with null", () => {
    expect(applyFilterPatch({ status: "todo", priority: "low" }, { priority: undefined })).toEqual({ status: "todo" });
    expect(applyFilterPatch({ status: "todo" }, { assignee: "u1" })).toEqual({ status: "todo", assignee: "u1" });
    expect(applyFilterPatch({ status: "todo" }, null)).toEqual({});
  });

  it("shows one column when filtering by status", () => {
    expect(visibleColumns({})).toEqual(["todo", "in_progress", "review", "done"]);
    expect(visibleColumns({ status: "review" })).toEqual(["review"]);
  });
});

describe("board data", () => {
  it("groups tasks into the four status columns", () => {
    const a = makeTask({ status: "todo" });
    const b = makeTask({ status: "done" });
    const groups = groupByStatus([a, b]);
    expect(groups.todo).toEqual([a]);
    expect(groups.done).toEqual([b]);
    expect(groups.in_progress).toEqual([]);
  });

  it("applies an optimistic move and respects a status filter", () => {
    const a = makeTask({ status: "todo" });
    const b = makeTask({ status: "todo" });
    expect(moveTaskInList([a, b], a._id, "done", undefined).map((t) => t.status)).toEqual(["done", "todo"]);
    expect(moveTaskInList([a, b], a._id, "done", "todo")).toEqual([b]);
  });
});
