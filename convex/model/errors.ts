import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "CONFLICT";

export type AppErrorData = { code: AppErrorCode; message: string };

export function appError(code: AppErrorCode, message: string): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}

/** Same response for missing projects and projects the caller cannot see, so existence is not leaked. */
export function projectNotFound(): ConvexError<AppErrorData> {
  return appError("NOT_FOUND", "Project not found or you do not have access to it.");
}
