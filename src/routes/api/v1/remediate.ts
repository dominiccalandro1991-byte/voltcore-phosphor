import { createFileRoute } from "@tanstack/react-router";
import { json, options } from "@/lib/voltcore/cors";
import { remediate } from "@/lib/voltcore/heal.server";
import type { VoltEvent } from "@/lib/voltcore/types";

export const Route = createFileRoute("/api/v1/remediate")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { event?: VoltEvent; autonomous?: boolean };
        const event = body.event;
        if (!event || !event.source) return json({ error: "event_required" }, 400);
        try {
          const result = await remediate(event, Boolean(body.autonomous));
          return json(result);
        } catch (err) {
          const e = err as { status?: number; code?: string; message?: string };
          return json({ error: e.code || "error", detail: e.message }, e.status || 500);
        }
      },
    },
  },
});
