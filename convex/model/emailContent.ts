export type AuthEmailKind = "verify_email" | "reset_password";

export type RenderedEmail = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const COPY = {
  verify_email: {
    subject: "Verify your SprintBoard email",
    intro: "Confirm this address to finish creating your SprintBoard account.",
    action: "Verify email",
    outro: "If you did not create an account, you can ignore this message.",
  },
  reset_password: {
    subject: "Reset your SprintBoard password",
    intro: "We received a request to reset your SprintBoard password.",
    action: "Choose a new password",
    outro: "The link expires in one hour. If you did not ask for a reset, ignore this message.",
  },
} as const satisfies Record<AuthEmailKind, Record<string, string>>;

export function renderAuthEmail(kind: AuthEmailKind, url: string): RenderedEmail {
  const copy = COPY[kind];
  const safeUrl = escapeHtml(url);
  return {
    subject: copy.subject,
    text: `${copy.intro}\n\n${copy.action}: ${url}\n\n${copy.outro}\n`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1c1917">
<h1 style="font-size:20px">SprintBoard</h1>
<p>${copy.intro}</p>
<p><a href="${safeUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${copy.action}</a></p>
<p style="font-size:13px;color:#57534e">${copy.outro}</p>
</div>`,
  };
}
