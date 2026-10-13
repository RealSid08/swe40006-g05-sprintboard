import { createFileRoute } from "@tanstack/react-router";
import { liveness } from "~/lib/health";

export const Route = createFileRoute("/health")({
  server: { handlers: { GET: () => liveness(process.env) } },
});
