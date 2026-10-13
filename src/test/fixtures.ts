import type { Id } from "../../convex/_generated/dataModel";
import type { Member } from "~/components/board/types";
import type { Task } from "~/lib/board";

export const owner: Member = { userId: "u_owner" as Id<"users">, name: "Olivia Owner", email: "olivia@example.test", role: "owner" };
export const member: Member = { userId: "u_member" as Id<"users">, name: "Max Member", email: "max@example.test", role: "member" };

let seq = 0;
export function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    _id: `t_${seq}` as Id<"tasks">,
    _creationTime: 1_700_000_000_000 + seq,
    projectId: "p_1" as Id<"projects">,
    title: `Task ${seq}`,
    description: "",
    status: "todo",
    priority: "medium",
    dueDate: null,
    assigneeId: null,
    createdBy: owner.userId,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}
