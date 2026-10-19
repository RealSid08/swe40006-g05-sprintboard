import { createFileRoute } from "@tanstack/react-router";
import { readiness } from "~/lib/health";

export const Route = createFileRoute("/ready")({
  server: { handlers: { GET: ({ request }) => readiness(process.env, request) } },
});
