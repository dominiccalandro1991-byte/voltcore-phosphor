import { getSql } from "@/lib/db";
import { publish } from "./bus";
import { asRecord, iso, newId } from "./json";
import type { InferenceResult, InferenceRun, JsonMap, TelemetryRow, VoltEvent } from "./types";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

async function mirrorSupabase(table: "events" | "system_telemetry", row: Record<string, unknown>) {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url.replace(/\/$/, "")}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch {
    /* mirror is best-effort */
  }
}

function eventFromRow(row: Record<string, unknown>): VoltEvent {
  return {
    id: String(row.id),
    created_at: iso(row.created_at),
    source: String(row.source || ""),
    event_type: String(row.event_type || "event"),
    severity: String(row.severity || "info"),
    payload: asRecord(row.payload),
    correlation_id: row.correlation_id == null ? null : String(row.correlation_id),
  };
}

function telFromRow(row: Record<string, unknown>): TelemetryRow {
  return {
    id: String(row.id),
    created_at: iso(row.created_at),
    correlation_id: String(row.correlation_id),
    channel: String(row.channel),
    model: row.model == null ? null : String(row.model),
    status: String(row.status),
    latency_ms: row.latency_ms == null ? null : Number(row.latency_ms),
    source: row.source == null ? null : String(row.source),
    metric: asRecord(row.metric),
  };
}

export async function insertEvent(input: {
  source: string;
  event_type: string;
  severity?: string;
  payload?: JsonMap;
  correlation_id?: string | null;
  id?: string;
}): Promise<VoltEvent> {
  const sql = await getSql();
  const id = input.id || newId();
  const source = input.source.slice(0, 80);
  const event_type = input.event_type.slice(0, 120);
  const severity = String(input.severity || "info").slice(0, 32).toLowerCase();
  const payload = input.payload || {};
  const correlation_id = input.correlation_id || null;
  const rows = await sql<Record<string, unknown>>`
    insert into events (id, source, event_type, severity, payload, correlation_id)
    values (${id}, ${source}, ${event_type}, ${severity}, ${JSON.stringify(payload)}::jsonb, ${correlation_id})
    returning id, created_at, source, event_type, severity, payload, correlation_id
  `;
  const ev = eventFromRow(rows[0] || { id, source, event_type, severity, payload, correlation_id });
  publish("event", ev);
  void mirrorSupabase("events", {
    id: ev.id,
    source: ev.source,
    event_type: ev.event_type,
    severity: ev.severity,
    payload: ev.payload,
  });
  return ev;
}

export async function insertTelemetry(input: {
  correlation_id: string;
  channel: string;
  status: string;
  model?: string | null;
  latency_ms?: number | null;
  source?: string | null;
  metric?: JsonMap;
}): Promise<TelemetryRow> {
  const sql = await getSql();
  const id = newId();
  const metric = input.metric || {};
  const rows = await sql<Record<string, unknown>>`
    insert into system_telemetry (id, correlation_id, channel, model, status, latency_ms, source, metric)
    values (
      ${id},
      ${input.correlation_id},
      ${input.channel.slice(0, 40)},
      ${input.model ?? null},
      ${input.status.slice(0, 32)},
      ${input.latency_ms ?? null},
      ${input.source ?? null},
      ${JSON.stringify(metric)}::jsonb
    )
    returning id, created_at, correlation_id, channel, model, status, latency_ms, source, metric
  `;
  const tel = telFromRow(rows[0] || { id, ...input, metric });
  publish("telemetry", tel);
  void mirrorSupabase("system_telemetry", {
    id: tel.id,
    correlation_id: tel.correlation_id,
    channel: tel.channel,
    model: tel.model,
    status: tel.status,
    latency_ms: tel.latency_ms,
    source: tel.source,
    metric: tel.metric,
  });
  return tel;
}

export async function insertRun(input: {
  correlation_id: string;
  prompt: string;
  consensus_score: number | null;
  winner_model: string | null;
  fused_summary: string | null;
  models: InferenceResult[];
}): Promise<InferenceRun> {
  const sql = await getSql();
  const id = newId();
  const rows = await sql<Record<string, unknown>>`
    insert into inference_runs (id, correlation_id, prompt, consensus_score, winner_model, fused_summary, models)
    values (
      ${id},
      ${input.correlation_id},
      ${input.prompt.slice(0, 4000)},
      ${input.consensus_score},
      ${input.winner_model},
      ${input.fused_summary},
      ${JSON.stringify(input.models)}::jsonb
    )
    returning id, created_at, correlation_id, prompt, consensus_score, winner_model, fused_summary, models
  `;
  const row = rows[0] || { id, ...input };
  const run: InferenceRun = {
    id: String(row.id),
    created_at: iso(row.created_at),
    correlation_id: String(row.correlation_id),
    prompt: String(row.prompt),
    consensus_score: row.consensus_score == null ? null : Number(row.consensus_score),
    winner_model: row.winner_model == null ? null : String(row.winner_model),
    fused_summary: row.fused_summary == null ? null : String(row.fused_summary),
    models: Array.isArray(row.models)
      ? (row.models as InferenceResult[])
      : input.models,
  };
  publish("run", run);
  return run;
}

export async function listEvents(limit = 150): Promise<VoltEvent[]> {
  const sql = await getSql();
  const cap = Math.min(200, Math.max(1, limit));
  const rows = await sql<Record<string, unknown>>`
    select id, created_at, source, event_type, severity, payload, correlation_id
    from events
    order by created_at desc
    limit ${cap}
  `;
  return rows.map(eventFromRow);
}

export async function listTelemetry(limit = 80): Promise<TelemetryRow[]> {
  const sql = await getSql();
  const cap = Math.min(200, Math.max(1, limit));
  const rows = await sql<Record<string, unknown>>`
    select id, created_at, correlation_id, channel, model, status, latency_ms, source, metric
    from system_telemetry
    order by created_at desc
    limit ${cap}
  `;
  return rows.map(telFromRow);
}

export async function listRuns(limit = 12): Promise<InferenceRun[]> {
  const sql = await getSql();
  const cap = Math.min(40, Math.max(1, limit));
  const rows = await sql<Record<string, unknown>>`
    select id, created_at, correlation_id, prompt, consensus_score, winner_model, fused_summary, models
    from inference_runs
    order by created_at desc
    limit ${cap}
  `;
  return rows.map((row) => ({
    id: String(row.id),
    created_at: iso(row.created_at),
    correlation_id: String(row.correlation_id),
    prompt: String(row.prompt),
    consensus_score: row.consensus_score == null ? null : Number(row.consensus_score),
    winner_model: row.winner_model == null ? null : String(row.winner_model),
    fused_summary: row.fused_summary == null ? null : String(row.fused_summary),
    models: Array.isArray(row.models) ? (row.models as InferenceResult[]) : [],
  }));
}

export async function eventCount(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from events`;
  return Number(rows[0]?.n || 0);
}
