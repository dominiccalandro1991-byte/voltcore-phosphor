import { createFileRoute } from "@tanstack/react-router";
import { json, options } from "@/lib/voltcore/cors";
import { ensureSeed } from "@/lib/voltcore/seed.server";
import { insertEvent, listEvents } from "@/lib/voltcore/telemetry.server";
import type { JsonMap } from "@/lib/voltcore/types";

export const Route = createFileRoute("/api/v1/events")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      GET: async ({ request }) => {
        await ensureSeed();
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") || 150);
        const events = await listEvents(limit);
        return json({ status: "ok", events, fetched_at: new Date().toISOString() });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          source?: string;
          type?: string;
          event_type?: string;
          severity?: string;
          payload?: JsonMap;
        };
        const source = String(body.source || "").trim();
        if (!source) return json({ error: "source_required", detail: "source required" }, 400);
        const event = await insertEvent({
          source,
          event_type: String(body.type || body.event_type || "event"),
          severity: body.severity,
          payload: body.payload && typeof body.payload === "object" ? body.payload : {},
        });
        return json({ status: "accepted", event }, 202);
      },
    },
  },
});
