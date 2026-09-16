import { FLEET } from "./fleet";
import { analyzePulse, fuseRails } from "./dual-rail";
import { dispatchDualRail, inferenceCapabilities, mondayPrompt } from "./inference.server";
import { newId } from "./json";
import { insertEvent, insertRun, insertTelemetry } from "./telemetry.server";
import type { MondayEvent } from "./types";

export async function runMondayPipeline(event: MondayEvent, correlationId: string): Promise<void> {
  const symbolic = analyzePulse(event);
  const prompt = mondayPrompt(event);
  await insertTelemetry({
    correlation_id: correlationId,
    channel: "pipeline",
    status: "pending",
    source: "monday",
    metric: { stage: "dispatch", pulse: event.pulseName ?? null, pulseId: event.pulseId ?? null },
  });

  const rails = await dispatchDualRail(prompt, event);
  for (const rail of rails) {
    await insertTelemetry({
      correlation_id: correlationId,
      channel: "inference",
      status: rail.status,
      model: rail.model,
      latency_ms: rail.latency_ms,
      source: "monday",
      metric: {
        rail: rail.rail,
        tokens: rail.tokens ?? 0,
        preview: (rail.text || rail.reason || "").slice(0, 240),
      },
    });
  }

  const consensus = fuseRails(rails);
  await insertRun({
    correlation_id: correlationId,
    prompt,
    consensus_score: consensus.score,
    winner_model: consensus.winnerModel,
    fused_summary: consensus.fusedSummary,
    models: rails,
  });
  await insertTelemetry({
    correlation_id: correlationId,
    channel: "consensus",
    status: consensus.winnerModel ? "fulfilled" : "rejected",
    model: consensus.winnerModel,
    source: "monday",
    metric: {
      score: consensus.score,
      jaccard: consensus.jaccard,
      dissent: consensus.dissent,
    },
  });

  await insertEvent({
    source: "monday",
    event_type: "monday.analyzed",
    severity: symbolic.severity,
    correlation_id: correlationId,
    payload: {
      pulseName: event.pulseName ?? null,
      pulseId: event.pulseId ?? null,
      boardId: event.boardId ?? null,
      columnId: event.columnId ?? null,
      status: consensus.winnerModel ? "analyzed" : "degraded",
      consensus: consensus.score,
      winner: consensus.winnerModel,
      summary: consensus.fusedSummary.slice(0, 1200),
      rails: rails.map((r) => ({ model: r.model, status: r.status, ms: r.latency_ms })),
    },
  });

  await insertTelemetry({
    correlation_id: correlationId,
    channel: "pipeline",
    status: "fulfilled",
    source: "monday",
    metric: { stage: "complete", score: consensus.score },
  });
}

export async function runCommand(action: string, source: string) {
  if (action !== "ping-all" && !FLEET[source] && source !== "monday") {
    throw Object.assign(new Error("Source not in fleet"), { status: 400, code: "unknown_source" });
  }
  if (action === "ping" || action === "ping-all") {
    const targets = action === "ping-all" ? Object.keys(FLEET) : [source];
    for (const src of targets) {
      await insertEvent({
        source: src,
        event_type: "mesh.ping",
        severity: "info",
        payload: { action: "ping", from: "core-api", ts: Date.now() },
      });
    }
    return { ok: true, action, targets };
  }
  if (action === "drain") {
    await insertEvent({
      source,
      event_type: "mesh.drain",
      severity: "info",
      payload: { action: "drain", requested: true },
    });
    return { ok: true, action, source };
  }
  if (action === "heartbeat") {
    await insertEvent({
      source,
      event_type: "health.heartbeat",
      severity: "info",
      payload: { status: "mesh-solicited", surface: "core-api" },
    });
    return { ok: true, action, source };
  }
  throw Object.assign(new Error("action must be ping | ping-all | drain | heartbeat"), {
    status: 400,
    code: "unknown_action",
  });
}

export async function fleetStatus() {
  const caps = inferenceCapabilities();
  return {
    status: "ok" as const,
    fleet: Object.keys(FLEET),
    mesh: caps.mesh,
    trunk: caps.trunk,
    neural: caps.neural,
    openrouter: caps.openrouter,
    supabase: caps.supabase,
  };
}

export { newId };
