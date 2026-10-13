import { useRouteContext } from "@tanstack/react-router";
import clsx from "clsx";
import { Info } from "lucide-react";

/**
 * Shown on deployments that cannot send email. AWS SES is unavailable in the Learner Lab,
 * so the public demo uses pre-created, verified synthetic accounts instead.
 */
export function DemoNotice({ className }: { className?: string }) {
  const { config } = useRouteContext({ from: "__root__" });
  if (config.emailDelivery) return null;
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
        Demo deployment. Email delivery is turned off because AWS SES is unavailable in the Learner Lab, so
        verification and password reset emails are not sent. Sign in with a provided demo account.
      </p>
    </div>
  );
}
