import { FLEET, FLEET_GROUPS, STALE_MS } from "./fleet";
import type { VoltEvent } from "./types";

export const WINDOW_MS = 15 * 60 * 1000;
export const CAP_PER_LANE = 96;
export const CAP_EVENTS = 512;

export type LaneTone = "idle" | "live" | "stale" | "danger";

export interface PhosphorTick {
  id: string;
  t: number;
  sev: string;
  type: string;
  source: string;
}

export interface PhosphorLane {
  id: string;
  repo: string;
  group: string;
  groupLabel: string;
  ticks: PhosphorTick[];
  lastT: number | null;
}

export interface PhosphorState {
  t0: number;
  t1: number;
  lanes: PhosphorLane[];
  index: Record<string, number>;
}

export interface PhosphorHit {
  lane: PhosphorLane;
  tick: PhosphorTick;
  dist: number;
}

/** O(L) create — one lane per fleet key plus unmapped catch-all. */
export function createPhosphor(now = Date.now()): PhosphorState {
  const lanes: PhosphorLane[] = [];
  const seen = new Set<string>();
  for (const g of FLEET_GROUPS) {
    for (const id of g.sources) {
      if (seen.has(id)) continue;
      seen.add(id);
      const spec = FLEET[id];
      lanes.push({
        id,
        repo: spec?.repo ?? "",
        group: spec?.group ?? g.id,
        groupLabel: spec?.groupLabel ?? g.label,
        ticks: [],
        lastT: null,
      });
    }
  }
  lanes.push({
    id: "_unmapped",
    repo: "",
    group: "unmapped",
    groupLabel: "Unmapped",
    ticks: [],
    lastT: null,
  });
  const index: Record<string, number> = {};
  lanes.forEach((l, i) => {
    index[l.id] = i;
  });
  return { t0: now - WINDOW_MS, t1: now, lanes, index };
}

/** O(1) lane lookup; unknown sources land on _unmapped. */
export function laneIndex(state: PhosphorState, source: string): number {
  if (source in state.index) return state.index[source];
  return state.index._unmapped;
}

function isDanger(sev: string): boolean {
  const s = sev.toLowerCase();
  return s === "critical" || s === "fatal" || s === "high" || s === "error";
}

/** O(1) amortized ingest into a ring buffer. */
export function ingestEvent(state: PhosphorState, ev: VoltEvent): PhosphorState {
  const t = new Date(ev.created_at).getTime();
  if (!Number.isFinite(t)) return state;
  const i = laneIndex(state, ev.source);
  const lane = state.lanes[i];
  if (lane.ticks.some((x) => x.id === ev.id)) return state;
  const tick: PhosphorTick = {
    id: ev.id,
    t,
    sev: ev.severity || "info",
    type: ev.event_type,
    source: ev.source,
  };
  const ticks = lane.ticks.length >= CAP_PER_LANE ? lane.ticks.slice(1).concat(tick) : lane.ticks.concat(tick);
  const lanes = state.lanes.slice();
  lanes[i] = { ...lane, ticks, lastT: Math.max(lane.lastT ?? 0, t) };
  return { ...state, lanes };
}

/** O(E) batch — E ≤ 150 typical. */
export function ingestMany(state: PhosphorState, events: VoltEvent[]): PhosphorState {
  let next = state;
  const slice = events.slice(0, CAP_EVENTS);
  for (let i = slice.length - 1; i >= 0; i--) next = ingestEvent(next, slice[i]);
  return next;
}

/** O(L) window slide — drop ticks older than t0. */
export function stepPhosphor(state: PhosphorState, now: number): PhosphorState {
  const t1 = now;
  const t0 = now - WINDOW_MS;
  const lanes = state.lanes.map((lane) => ({
    ...lane,
    ticks: lane.ticks.filter((tk) => tk.t >= t0),
  }));
  return { ...state, t0, t1, lanes };
}

export function laneTone(lane: PhosphorLane, now: number): LaneTone {
  if (!lane.lastT) return "idle";
  if (lane.ticks.some((tk) => isDanger(tk.sev) && now - tk.t < STALE_MS * 2)) return "danger";
  if (now - lane.lastT > STALE_MS) return "stale";
  return "live";
}

/** O(log E_lane) nearest tick on a lane given time. */
export function selectTick(lane: PhosphorLane, t: number): PhosphorTick | null {
  const arr = lane.ticks;
  if (!arr.length) return null;
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  const a = arr[lo];
  const b = arr[Math.max(0, lo - 1)];
  return Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b;
}

/** O(L) hit-test from canvas coords. */
export function hitTest(
  state: PhosphorState,
  x: number,
  y: number,
  width: number,
  rowH: number,
  padL: number,
): PhosphorHit | null {
  const i = Math.floor(y / rowH);
  const lane = state.lanes[i];
  if (!lane) return null;
  const span = Math.max(1, state.t1 - state.t0);
  const t = state.t0 + ((x - padL) / Math.max(1, width - padL)) * span;
  const tick = selectTick(lane, t);
  if (!tick) return { lane, tick: { id: "", t, sev: "info", type: "", source: lane.id }, dist: Infinity };
  const tx = padL + ((tick.t - state.t0) / span) * (width - padL);
  return { lane, tick, dist: Math.hypot(tx - x, 0) };
}

export function serializePhosphor(state: PhosphorState): string {
  return JSON.stringify({
    t0: state.t0,
    t1: state.t1,
    lanes: state.lanes.map((l) => ({
      id: l.id,
      lastT: l.lastT,
      n: l.ticks.length,
    })),
  });
}

export function xOf(state: PhosphorState, t: number, width: number, padL: number): number {
  const span = Math.max(1, state.t1 - state.t0);
  return padL + ((t - state.t0) / span) * (width - padL);
}
