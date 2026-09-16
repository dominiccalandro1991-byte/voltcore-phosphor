import { ANOMALY, ANOMALY_TTL_MS, RESOLVED_STATUS, STALE_MS } from "./fleet";
import type { AnomalyKind, JsonMap, VoltEvent } from "./types";

function rec(payload: JsonMap | undefined): JsonMap {
  return payload && typeof payload === "object" ? payload : {};
}

/** O(1) severity membership. */
export function isAnomaly(sev: string | undefined): boolean {
  return ANOMALY.has(String(sev || "").toLowerCase());
}

/**
 * Classify an anomaly against later same-source recoveries.
 * O(n) over the event window for a single event; call once per event.
 */
export function anomalyState(ev: VoltEvent, events: VoltEvent[], now: number): AnomalyKind {
  if (!isAnomaly(ev.severity)) return "none";
  const evT = new Date(ev.created_at).getTime();
  const er = rec(ev.payload);
  const superseded = events.some((later) => {
    if (later.id === ev.id) return false;
    const laterT = new Date(later.created_at).getTime();
    if (!(laterT > evT)) return false;
    if (later.source !== ev.source) return false;
    const lr = rec(later.payload);
    const sameInc =
      lr.incident && er.incident && String(lr.incident) === String(er.incident);
    const sameType = later.event_type === ev.event_type;
    const status = String(lr.status || "").toLowerCase();
    if (sameInc && (RESOLVED_STATUS.has(status) || !isAnomaly(later.severity))) return true;
    if (sameType && RESOLVED_STATUS.has(status)) return true;
    if (
      sameType &&
      !isAnomaly(later.severity) &&
      /recovery|resolve|patch/i.test(`${later.event_type} ${status}`)
    ) {
      return true;
    }
    return false;
  });
  if (superseded) return "resolved";
  if (Number.isFinite(evT) && now - evT > ANOMALY_TTL_MS) return "aged";
  return "active";
}

export type GroupTone = "ok" | "warn" | "danger" | "muted";

export interface SourceHealth {
  source: string;
  count: number;
  lastAt: string | null;
  lastSev: string;
  lastType: string;
  activeWorst: string | null;
}

/** O(n) rollup of events into per-source health. */
export function sourceRollup(events: VoltEvent[], now: number): Map<string, SourceHealth> {
  const map = new Map<string, SourceHealth>();
  for (const ev of events) {
    const src = ev.source || "unknown";
    const cur = map.get(src) || {
      source: src,
      count: 0,
      lastAt: ev.created_at,
      lastSev: ev.severity || "info",
      lastType: ev.event_type || "event",
      activeWorst: null as string | null,
    };
    cur.count += 1;
    if (ev.created_at && (!cur.lastAt || ev.created_at > cur.lastAt)) {
      cur.lastAt = ev.created_at;
      cur.lastSev = ev.severity || "info";
      cur.lastType = ev.event_type || "event";
    }
    map.set(src, cur);
  }
  for (const ev of events) {
    if (anomalyState(ev, events, now) !== "active") continue;
    const cur = map.get(ev.source || "unknown");
    if (cur) cur.activeWorst = ev.severity;
  }
  return map;
}

export function groupTone(members: SourceHealth[], now: number): GroupTone {
  if (members.some((m) => m.activeWorst)) return "danger";
  const live = members.filter((m) => m.count);
  if (!live.length) return "muted";
  if (live.every((m) => m.lastAt && now - new Date(m.lastAt).getTime() > STALE_MS)) {
    return "warn";
  }
  return "ok";
}

export function isStale(lastAt: string | null, now: number): boolean {
  if (!lastAt) return false;
  return now - new Date(lastAt).getTime() > STALE_MS;
}
