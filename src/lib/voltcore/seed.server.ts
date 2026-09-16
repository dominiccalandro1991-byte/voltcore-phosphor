import type { JsonMap } from "./types";
import { eventCount, insertEvent, insertTelemetry } from "./telemetry.server";

const g = globalThis as typeof globalThis & { __voltSeeded__?: Promise<void> };

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

/** Idempotent demo fleet so the instrument panel is live on first paint. */
export async function ensureSeed(): Promise<void> {
  if (!g.__voltSeeded__) {
    g.__voltSeeded__ = (async () => {
      if ((await eventCount()) > 0) return;
      const corr = "seed-fleet-bootstrap";
      const rows: Array<{
        source: string;
        event_type: string;
        severity: string;
        payload: JsonMap;
        created?: string;
      }> = [
        {
          source: "storm-path-web",
          event_type: "health.heartbeat",
          severity: "info",
          payload: { gps_accuracy: 0.94, nws_radar_status: true, frame_rate: 58, status: "ok" },
        },
        {
          source: "storm-path-mobile",
          event_type: "health.heartbeat",
          severity: "info",
          payload: { gps_accuracy: 0.88, weather_api_health: true, status: "ok" },
        },
        {
          source: "storm-path",
          event_type: "health.heartbeat",
          severity: "info",
          payload: { nws_radar_status: true, frame_rate: 60, status: "ok" },
        },
        {
          source: "nano-sandbox",
          event_type: "health.heartbeat",
          severity: "info",
          payload: { active_containers: 3, execution_errors: 0, api_rate_limit_remaining: 842 },
        },
        {
          source: "snca-codec",
          event_type: "health.heartbeat",
          severity: "info",
          payload: { cpu_utilization: 0.31, memory_mb: 186, edge_latency: 42, uptime_seconds: 86400 },
        },
        {
          source: "nano-cloud",
          event_type: "health.heartbeat",
          severity: "info",
          payload: { cpu_utilization: 0.22, memory_mb: 94, edge_latency: 28 },
        },
        {
          source: "voltcore-command-center",
          event_type: "health.heartbeat",
          severity: "info",
          payload: { status: "ok", surface: "command-center" },
        },
        {
          source: "grok-orchestration-engine",
          event_type: "pipeline.fault",
          severity: "high",
          payload: { incident: "orc-0706", status: "open", detail: "model timeout on heal rail" },
        },
        {
          source: "grok-orchestration-engine",
          event_type: "system.recovery",
          severity: "info",
          payload: { status: "patched", incident: "orc-0706" },
        },
        {
          source: "monday",
          event_type: "monday.ingested",
          severity: "info",
          payload: { pulseName: "Mesh HMAC rotation", pulseId: 91001, boardId: 42, status: "ack" },
        },
      ];
      for (const row of rows) {
        await insertEvent({
          source: row.source,
          event_type: row.event_type,
          severity: row.severity,
          payload: row.payload,
          correlation_id: corr,
        });
      }
      await insertTelemetry({
        correlation_id: corr,
        channel: "ingress",
        status: "acked",
        source: "seed",
        metric: { note: "bootstrap fleet heartbeats" },
      });
      void minutesAgo;
    })();
  }
  return g.__voltSeeded__;
}
