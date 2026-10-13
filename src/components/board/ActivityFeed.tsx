import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { relativeTime } from "~/lib/format";
import type { ActivityEntry } from "./types";

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function ActivityFeed({ entries }: { entries: readonly ActivityEntry[] | undefined }) {
  const now = useNow();
  return (
    <section aria-labelledby="activity-heading" className="card flex flex-col p-4">
      <h2 id="activity-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-ink-soft" aria-hidden="true" />
        Activity
      </h2>
      {entries === undefined ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-sunken" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-faint">No activity yet.</p>
      ) : (
        <ol className="relative space-y-3.5 before:absolute before:top-1 before:bottom-1 before:left-[5px] before:w-px before:bg-line" data-testid="activity-feed">
          {entries.map((entry) => (
            <li key={entry._id} className="relative pl-5 text-[13px] leading-snug">
              <span className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-surface bg-line-strong" aria-hidden="true" />
              <span className="font-medium text-ink">{entry.actorName}</span>{" "}
              <span className="text-ink-soft">{entry.summary}</span>
              <time
                dateTime={new Date(entry.createdAt).toISOString()}
                title={new Date(entry.createdAt).toLocaleString("en-AU")}
                className="mt-0.5 block text-[11px] text-ink-faint"
              >
                {relativeTime(entry.createdAt, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
