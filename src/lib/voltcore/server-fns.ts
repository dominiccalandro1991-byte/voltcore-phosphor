import { createServerFn } from "@tanstack/react-start";
import { runCommand, runMondayPipeline } from "./pipeline.server";
import { scheduleBackground } from "./schedule";
import { insertEvent, insertTelemetry, listEvents, listRuns, listTelemetry } from "./telemetry.server";
import { newId } from "./json";
import { mergeSnapshot, pullTrunkEvents, pullTrunkHealth, TRUNK_ORIGIN } from "./trunk";
import type { CommandCenterSnapshot, JsonMap, MondayEvent } from "./types";

const EMPTY_FLEET = {
  status: "ok" as const,
  fleet: [] as string[],
  mesh: false,
  trunk: false,
  neural: false,
  openrouter: false,
  supabase: false,
};

async function localSnapshot(): Promise<CommandCenterSnapshot | null> {
  try {
    const [events, telemetry, runs] = await Promise.all([
      listEvents(150),
      listTelemetry(80),
      listRuns(12),
    ]);
    return { events, telemetry, runs, fleet: EMPTY_FLEET, fetched_at: new Date().toISOString() };
  } catch {
    return null;
  }
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<CommandCenterSnapshot> => {
    const [local, trunkEvents, trunkFleet] = await Promise.all([
      localSnapshot(),
      pullTrunkEvents(150).catch(() => []),
      pullTrunkHealth().catch(() => null),
    ]);
    const base: CommandCenterSnapshot =
      local ??
      ({
        events: [],
        telemetry: [],
        runs: [],
        fleet: EMPTY_FLEET,
        fetched_at: new Date().toISOString(),
      } satisfies CommandCenterSnapshot);
    return mergeSnapshot(base, trunkEvents, trunkFleet);
  },
);

export const pingFleet = createServerFn({ method: "POST" })
  .validator((input: { action: string; source: string }) => input)
  .handler(async ({ data }) => {
    try {
      return await runCommand(data.action, data.source);
    } catch {
      await fetch(`${TRUNK_ORIGIN}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: data.source || "voltcore-command-center",
          event_type: "mesh.ping",
          severity: "info",
          payload: { action: data.action, via: "phosphor-ui" },
        }),
      });
      return { ok: true, action: data.action, targets: [data.source] };
    }
  });

export const fireMonday = createServerFn({ method: "POST" })
  .validator((input: { pulseName: string; severity?: string; boardId?: number }) => input)
  .handler(async ({ data }) => {
    const correlationId = newId();
    const event: MondayEvent = {
      boardId: data.boardId ?? 8801,
      pulseId: Math.floor(Math.random() * 90_000) + 10_000,
      pulseName: data.pulseName.slice(0, 160) || "Untitled pulse",
      columnId: "status",
      value: { label: data.severity || "info" },
      type: "update_column_value",
    };
    await fetch(`${TRUNK_ORIGIN}/api/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "monday",
        event_type: "monday.ingested",
        severity: "info",
        payload: {
          status: "ack",
          pulseName: event.pulseName ?? "",
          pulseId: event.pulseId ?? null,
          boardId: event.boardId ?? null,
          via: "phosphor-ui",
        },
      }),
    }).catch(() => null);
    try {
      await insertEvent({
        source: "monday",
        event_type: "monday.ingested",
        severity: "info",
        correlation_id: correlationId,
        payload: {
          status: "ack",
          pulseName: event.pulseName ?? "",
          pulseId: event.pulseId ?? null,
          boardId: event.boardId ?? null,
        },
      });
      await insertTelemetry({
        correlation_id: correlationId,
        channel: "ingress",
        status: "acked",
        source: "monday",
        metric: { handshake: "simulated", pulseName: event.pulseName ?? "" },
      });
      scheduleBackground(() => runMondayPipeline(event, correlationId));
    } catch {
      /* Vercel has no DB and no Dual-Rail keys — trunk ingest is enough */
    }
    return { status: "acknowledged" as const, correlationId, event };
  });

export const ingestClientEvent = createServerFn({ method: "POST" })
  .validator(
    (input: {
      source: string;
      event_type: string;
      severity?: string;
      payload?: JsonMap;
    }) => input,
  )
  .handler(async ({ data }) => {
    if (!data.source?.trim()) throw new Error("source required");
    try {
      return await insertEvent({
        source: data.source,
        event_type: data.event_type || "event",
        severity: data.severity,
        payload: data.payload,
      });
    } catch {
      const res = await fetch(`${TRUNK_ORIGIN}/api/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    }
  });
