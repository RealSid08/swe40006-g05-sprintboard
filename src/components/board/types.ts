import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type ProjectDetail = FunctionReturnType<typeof api.projects.get>;
export type Member = ProjectDetail["members"][number];
export type ActivityEntry = FunctionReturnType<typeof api.activity.list>[number];
