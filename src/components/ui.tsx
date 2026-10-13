import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { avatarTone, initials } from "~/lib/format";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0f766e" />
        <rect x="7" y="8" width="5" height="16" rx="1.5" fill="#fff" />
        <rect x="13.5" y="8" width="5" height="11" rx="1.5" fill="#fff" opacity=".85" />
        <rect x="20" y="8" width="5" height="7" rx="1.5" fill="#fff" opacity=".7" />
      </svg>
      <span>SprintBoard</span>
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("size-4 animate-spin", className)} aria-hidden="true" />;
}

export function Avatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  seed: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      title={name}
      aria-label={name}
      role="img"
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface",
        avatarTone(seed),
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-10 text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
      {message}
    </div>
  );
}

/** Accessible modal built on the native dialog element (focus trap and Escape for free). */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={clsx(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-dialog",
        size === "md" ? "max-w-md" : "max-w-2xl",
      )}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div>
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
            </div>
            <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label="Close dialog">
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 pb-5">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-6 py-3.5 rounded-b-2xl">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
