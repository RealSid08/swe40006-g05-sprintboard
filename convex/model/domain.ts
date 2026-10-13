import { v, type Infer } from "convex/values";

export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const taskStatusValidator = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("review"),
  v.literal("done"),
);
export const taskPriorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);
export const memberRoleValidator = v.union(v.literal("owner"), v.literal("member"));

export type TaskStatus = Infer<typeof taskStatusValidator>;
export type TaskPriority = Infer<typeof taskPriorityValidator>;
export type MemberRole = Infer<typeof memberRoleValidator>;

export const STATUS_LABELS = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
} as const satisfies Record<TaskStatus, string>;

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const satisfies Record<TaskPriority, string>;

export const PRIORITY_RANK = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
} as const satisfies Record<TaskPriority, number>;

export const LIMITS = {
  projectName: 80,
  projectDescription: 500,
  taskTitle: 120,
  taskDescription: 2000,
  /** Upper bound on tasks returned for one board. */
  boardTasks: 500,
  /** Upper bound on projects listed for one user. */
  projectsPerUser: 100,
  /** Upper bound on members listed for one project. */
  membersPerProject: 100,
  activityItems: 40,
  /** Documents touched by one cleanup batch before rescheduling. */
  cleanupBatch: 200,
} as const;
