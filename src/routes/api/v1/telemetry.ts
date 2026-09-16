import { createFileRoute } from "@tanstack/react-router";
import { json, options } from "@/lib/voltcore/cors";
import { listRuns, listTelemetry } from "@/lib/voltcore/telemetry.server";

export const Route = createFileRoute("/api/v1/telemetry")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") || 80);
        const [telemetry, runs] = await Promise.all([listTelemetry(limit), listRuns(12)]);
        return json({ status: "ok", telemetry, runs, fetched_at: new Date().toISOString() });
      },
    },
  },
});
