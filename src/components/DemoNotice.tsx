import { useRouteContext } from "@tanstack/react-router";
import clsx from "clsx";
import { Info } from "lucide-react";

/** True when this deployment can send verification and password reset emails. */
export function useEmailDelivery(): boolean {
  return useRouteContext({ from: "__root__" }).config.emailDelivery;
}

/**
 * Shown on deployments with email delivery disabled (`EMAIL_TRANSPORT=disabled`). There the backend
 * skips email verification, so visitors can register and start straight away.
 */
export function DemoNotice({ className }: { className?: string }) {
  if (useEmailDelivery()) return null;
  return (
    <div
      role="note"
      data-testid="demo-notice"
      className={clsx(
        "flex gap-2.5 rounded-lg border border-[#c27803]/30 bg-[#fff8eb] px-3 py-2.5 text-[13px] leading-snug text-[#7a4b00]",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        Demo deployment. Create an account and start right away, with no email verification step. Email delivery
        is off, so password reset emails are not sent. Keep your password somewhere safe.
      </p>
    </div>
  );
}
