import { createFileRoute } from "@tanstack/react-router";
import { json, options } from "@/lib/voltcore/cors";
import { newId } from "@/lib/voltcore/json";
import { parseMondayBody, verifyMondaySignature } from "@/lib/voltcore/monday.server";
import { runMondayPipeline } from "@/lib/voltcore/pipeline.server";
import { scheduleBackground } from "@/lib/voltcore/schedule";
import { insertEvent, insertTelemetry } from "@/lib/voltcore/telemetry.server";

export const Route = createFileRoute("/api/v1/webhooks/monday")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const challenge = url.searchParams.get("challenge");
        if (challenge) return json({ challenge });
        return json({ status: "ok", ingest: "monday" });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: unknown = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return json({ error: "invalid_json" }, 400);
        }
        const payload = parseMondayBody(body);
        if (payload.challenge) {
          return json({ challenge: payload.challenge });
        }
        const ok = await verifyMondaySignature(request, raw);
        if (!ok) return json({ error: "invalid_signature" }, 401);
        if (!payload.event) {
          return json({ error: "Invalid payload structure: missing event context." }, 400);
        }
        const correlationId = newId();
        await insertEvent({
          source: "monday",
          event_type: "monday.ingested",
          severity: "info",
          correlation_id: correlationId,
          payload: {
            status: "ack",
            pulseName: payload.event.pulseName ?? null,
            pulseId: payload.event.pulseId ?? null,
            boardId: payload.event.boardId ?? null,
            columnId: payload.event.columnId ?? null,
          },
        });
        await insertTelemetry({
          correlation_id: correlationId,
          channel: "ingress",
          status: "acked",
          source: "monday",
          metric: { handshake: "http200", pulseName: payload.event.pulseName ?? null },
        });
        const event = payload.event;
        scheduleBackground(() => runMondayPipeline(event, correlationId));
        return json({ status: "acknowledged", correlationId, timestamp: Date.now() });
      },
    },
  },
});
