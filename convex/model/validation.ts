import { LIMITS } from "./domain";
import { appError } from "./errors";

export function requireText(value: string, field: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw appError("INVALID_INPUT", `${field} cannot be blank.`);
  }
  if (trimmed.length > maxLength) {
    throw appError("INVALID_INPUT", `${field} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

export function optionalText(value: string, field: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw appError("INVALID_INPUT", `${field} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Accepts a real calendar date in YYYY-MM-DD form, or null. */
export function parseDueDate(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;
  const match = DATE_PATTERN.exec(value.trim());
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (
      date.getUTCFullYear() === Number(y) &&
      date.getUTCMonth() === Number(m) - 1 &&
      date.getUTCDate() === Number(d)
    ) {
      return value.trim();
    }
  }
  throw appError("INVALID_INPUT", "Due date must be a valid date (YYYY-MM-DD).");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw appError("INVALID_INPUT", "Enter a valid email address.");
  }
  return email;
}

export const validateProjectName = (name: string) =>
  requireText(name, "Project name", LIMITS.projectName);
export const validateProjectDescription = (description: string) =>
  optionalText(description, "Description", LIMITS.projectDescription);
export const validateTaskTitle = (title: string) => requireText(title, "Title", LIMITS.taskTitle);
export const validateTaskDescription = (description: string) =>
  optionalText(description, "Description", LIMITS.taskDescription);
