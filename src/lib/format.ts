export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const AVATAR_TONES = [
  "bg-[#dbeafe] text-[#1e40af]",
  "bg-[#dcfce7] text-[#166534]",
  "bg-[#fef3c7] text-[#92400e]",
  "bg-[#fce7f3] text-[#9d174d]",
  "bg-[#ede9fe] text-[#5b21b6]",
  "bg-[#ccfbf1] text-[#115e59]",
  "bg-[#ffedd5] text-[#9a3412]",
] as const;

/** Stable colour per person so avatars are recognisable across the board. */
export function avatarTone(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0];
}

export function relativeTime(timestamp: number, now: number): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/** Local calendar date as YYYY-MM-DD. */
export function todayIso(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function dueState(dueDate: string, today: string): DueState {
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  const days = (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= 3 ? "soon" : "later";
}

export function formatDue(dueDate: string, today: string): string {
  const state = dueState(dueDate, today);
  if (state === "today") return "Due today";
  const label = new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  return state === "overdue" ? `Overdue, ${label}` : `Due ${label}`;
}
