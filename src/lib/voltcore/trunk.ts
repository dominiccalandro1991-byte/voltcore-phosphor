import type { CommandCenterSnapshot, FleetSnapshot, VoltEvent } from "./types";

export const TRUNK_ORIGIN = "https://core-api.dominic-calandro1991.workers.dev";

function asEvent(row: Partial<VoltEvent> & { id?: string }): VoltEvent | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    created_at: String(row.created_at || new Date().toISOString()),
    source: String(row.source || "unmapped"),
    event_type: String(row.event_type || "event"),
    severity: String(row.severity || "info"),
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    correlation_id: row.correlation_id ?? null,
  };
}

export async function pullTrunkEvents(limit = 150): Promise<VoltEvent[]> {
  const res = await fetch(`${TRUNK_ORIGIN}/api/v1/events?limit=${limit}`);
  if (!res.ok) throw new Error(`trunk events ${res.status}`);
  const body = (await res.json()) as { events?: Partial<VoltEvent>[] };
  return (body.events || []).map(asEvent).filter((e): e is VoltEvent => Boolean(e));
}

export async function pullTrunkHealth(): Promise<FleetSnapshot | null> {
  const res = await fetch(`${TRUNK_ORIGIN}/api/v1/health`);
  if (!res.ok) return null;
  const body = (await res.json()) as FleetSnapshot;
  return body;
}

export async function remediateOnTrunk(event: VoltEvent): Promise<{
  summary?: string;
  patch?: string;
  model?: string;
  status?: string;
}> {
  const res = await fetch(`${TRUNK_ORIGIN}/api/v1/remediate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  });
  const data = (await res.json()) as {
    summary?: string;
    patch?: string;
    model?: string;
    detail?: string;
    error?: string;
    status?: string;
  };
  if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  return data;
}

export function mergeSnapshot(
  local: CommandCenterSnapshot,
  trunkEvents: VoltEvent[],
  trunkFleet: FleetSnapshot | null,
): CommandCenterSnapshot {
  const map = new Map<string, VoltEvent>();
  for (const ev of trunkEvents) map.set(ev.id, ev);
  for (const ev of local.events) if (!map.has(ev.id)) map.set(ev.id, ev);
  const events = [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150);
  return {
    ...local,
    events,
    fleet: trunkFleet ?? local.fleet,
    fetched_at: new Date().toISOString(),
  };
}
