import { Crown, LogOut, UserMinus, UserPlus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorMessage } from "~/lib/errors";
import { Avatar, FormError, Spinner } from "../ui";
import type { Member } from "./types";

export function MembersPanel({
  members,
  currentUserId,
  isOwner,
  onAdd,
  onRemove,
  onLeave,
}: {
  members: readonly Member[];
  currentUserId: string;
  isOwner: boolean;
  onAdd: (email: string) => Promise<void>;
  onRemove: (member: Member) => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    setPending(key);
    setError(null);
    try {
      await action();
      setConfirming(null);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setPending(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    void run("add", async () => {
      await onAdd(value);
      setEmail("");
    });
  }

  return (
    <section aria-labelledby="members-heading" className="card p-4" data-testid="members-panel">
      <h2 id="members-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users className="size-4 text-ink-soft" aria-hidden="true" />
        Members
        <span className="rounded-full bg-sunken px-1.5 text-[11px] font-medium text-ink-soft tabular-nums">
          {members.length}
        </span>
      </h2>
      <div className="space-y-3">
        <FormError message={error} />
        <ul className="space-y-2">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const key = `remove:${member.userId}`;
            return (
              <li key={member.userId} className="flex items-center gap-2.5" data-testid="member-row">
                <Avatar name={member.name} seed={member.userId} size="md" />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                    {member.name}
                    {isSelf ? <span className="text-ink-faint font-normal">(you)</span> : null}
                    {member.role === "owner" ? (
                      <Crown className="size-3.5 shrink-0 text-[#b54708]" aria-label="Owner" role="img" />
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-ink-faint">{member.email}</div>
                </div>
                {isOwner && member.role !== "owner" ? (
                  confirming === key ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-danger btn-sm h-7 px-2"
                        disabled={pending !== null}
                        onClick={() => void run(key, () => onRemove(member))}
                      >
                        {pending === key ? <Spinner /> : null}
                        Remove
                      </button>
                      <button type="button" className="btn-ghost btn-sm h-7 px-2" onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn size-7"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setConfirming(key)}
                    >
                      <UserMinus className="size-4" />
                    </button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
        {isOwner ? (
          <form onSubmit={submit} className="flex gap-2 border-t border-line pt-3">
            <label htmlFor="member-email" className="sr-only">
              Teammate email
            </label>
            <input
              id="member-email"
              type="email"
              className="input h-8 text-[13px]"
              placeholder="teammate@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="btn-secondary btn-sm shrink-0" disabled={pending !== null || !email.trim()}>
              {pending === "add" ? <Spinner /> : <UserPlus className="size-4" aria-hidden="true" />}
              Add
            </button>
          </form>
        ) : confirming === "leave" ? (
          <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-[13px]">
            <span className="text-ink-soft">Leave this project?</span>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn-danger btn-sm h-7 px-2"
                disabled={pending !== null}
                onClick={() => void run("leave", onLeave)}
              >
                {pending === "leave" ? <Spinner /> : null}
                Leave
              </button>
              <button type="button" className="btn-ghost btn-sm h-7 px-2" onClick={() => setConfirming(null)}>
                Stay
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-line pt-3">
            <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setConfirming("leave")}>
              <LogOut className="size-4" aria-hidden="true" />
              Leave project
            </button>
          </div>
        )}
        {isOwner ? (
          <p className="text-xs text-ink-faint">Teammates need a verified SprintBoard account first.</p>
        ) : null}
      </div>
    </section>
  );
}
