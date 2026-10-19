/** Only same-origin absolute paths are allowed as post-login destinations. */
export function safeRedirect(value: unknown, fallback = "/projects"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/api/")) return fallback;
  return value;
}
