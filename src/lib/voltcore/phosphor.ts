import { FLEET, FLEET_GROUPS, STALE_MS } from "./fleet";
import type { VoltEvent } from "./types";

export const WINDOW_MS = 15 * 60 * 1000;
export const CAP_PER_LANE = 96;
export const CAP_EVENTS = 512;
export const CATCH_ALL = "_unmapped";
const CATCH_ALL_ALIAS = "unmapped";

export type LaneTone = "idle" | "live" | "stale" | "danger" | "armed";

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
  present: boolean;
}

export interface PhosphorState {
  t0: number;
  t1: number;
  lanes: PhosphorLane[];
  index: Record<string, number>;
}

export interface PhosphorHit {
  lane: PhosphorLane;
  tick: PhosphorTick | null;
  dist: number;
}

function emptyLane(id: string, spec: (typeof FLEET)[string] | undefined, group: string, groupLabel: string): PhosphorLane {
  return {
    id,
    repo: spec?.repo ?? "",
    group: spec?.group ?? group,
    groupLabel: spec?.groupLabel ?? groupLabel,
    ticks: [],
    lastT: null,
    present: false,
  };
}

function isCatchAll(source: string): boolean {
  return !source || source === CATCH_ALL || source === CATCH_ALL_ALIAS;
}

function bindCatchAll(index: Record<string, number>, slot: number): void {
  index[CATCH_ALL] = slot;
  index[CATCH_ALL_ALIAS] = slot;
}

function ensureCatchAll(state: PhosphorState): PhosphorState {
  const i = state.index[CATCH_ALL];
  if (i != null && state.lanes[i]?.id === CATCH_ALL) return state;
  const lane = emptyLane(CATCH_ALL, undefined, "unmapped", "Unmapped");
  const lanes = state.lanes.concat(lane);
  const index = { ...state.index };
  bindCatchAll(index, lanes.length - 1);
  return { ...state, lanes, index };
}

function pruneIdleCatchAll(state: PhosphorState): PhosphorState {
  const last = state.lanes[state.lanes.length - 1];
  if (!last || last.id !== CATCH_ALL) return state;
  if (laneHasSignal(last)) return state;
  const lanes = state.lanes.slice(0, -1);
  const index = { ...state.index };
  bindCatchAll(index, lanes.length);
  return { ...state, lanes, index };
}

/** O(L) create — one lane per fleet key. Catch-all stays in index only until it has ticks. */
export function createPhosphor(now = Date.now()): PhosphorState {
  const lanes: PhosphorLane[] = [];
  const seen = new Set<string>();
  for (const g of FLEET_GROUPS) {
    for (const id of g.sources) {
      if (seen.has(id)) continue;
      seen.add(id);
      lanes.push(emptyLane(id, FLEET[id], g.id, g.label));
    }
  }
  const index: Record<string, number> = {};
  lanes.forEach((l, i) => {
    index[l.id] = i;
  });
  bindCatchAll(index, lanes.length);
  return { t0: now - WINDOW_MS, t1: now, lanes, index };
}

export function laneIndex(state: PhosphorState, source: string): number {
  if (isCatchAll(source)) return state.index[CATCH_ALL];
  if (source in state.index) return state.index[source];
  return state.index[CATCH_ALL];
}

function isDanger(sev: string): boolean {
  const s = sev.toLowerCase();
  return s === "critical" || s === "fatal" || s === "high" || s === "error";
}

export function ingestEvent(state: PhosphorState, ev: VoltEvent): PhosphorState {
  const t = new Date(ev.created_at).getTime();
  if (!Number.isFinite(t)) return state;
  const next = isCatchAll(ev.source) || !(ev.source in state.index) ? ensureCatchAll(state) : state;
  const i = laneIndex(next, ev.source);
  const lane = next.lanes[i];
  if (!lane) return next;
  if (lane.ticks.some((x) => x.id === ev.id)) return next;
  const tick: PhosphorTick = {
    id: ev.id,
    t,
    sev: ev.severity || "info",
    type: ev.event_type,
    source: ev.source,
  };
  const ticks = lane.ticks.length >= CAP_PER_LANE ? lane.ticks.slice(1).concat(tick) : lane.ticks.concat(tick);
  const lanes = next.lanes.slice();
  lanes[i] = { ...lane, ticks, lastT: Math.max(lane.lastT ?? 0, t), present: true };
  return { ...next, lanes };
}

export function ingestMany(state: PhosphorState, events: VoltEvent[]): PhosphorState {
  let next = state;
  const slice = events.slice(0, CAP_EVENTS);
  for (let i = slice.length - 1; i >= 0; i--) next = ingestEvent(next, slice[i]);
  return next;
}

export function markPresent(state: PhosphorState, fleetIds: string[]): PhosphorState {
  if (!fleetIds.length) return state;
  const set = new Set(fleetIds);
  const lanes = state.lanes.map((lane) => (set.has(lane.id) ? { ...lane, present: true } : lane));
  return { ...state, lanes };
}

export function stepPhosphor(state: PhosphorState, now: number): PhosphorState {
  const t1 = now;
  const t0 = now - WINDOW_MS;
  const lanes = state.lanes.map((lane) => ({
    ...lane,
    ticks: lane.ticks.filter((tk) => tk.t >= t0),
  }));
  return { ...state, t0, t1, lanes };
}

/** Trunk lattice ids + events → lattice. O(L + E). Idle catch-all is not rendered. */
export function hydratePhosphor(events: VoltEvent[], fleetIds: string[], now: number): PhosphorState {
  return pruneIdleCatchAll(stepPhosphor(markPresent(ingestMany(createPhosphor(now), events), fleetIds), now));
}

export function laneHasSignal(lane: PhosphorLane): boolean {
  return lane.present || lane.lastT != null || lane.ticks.length > 0;
}

export function laneTone(lane: PhosphorLane, now: number): LaneTone {
  if (lane.ticks.some((tk) => isDanger(tk.sev) && now - tk.t < STALE_MS * 2)) return "danger";
  if (lane.lastT && now - lane.lastT <= STALE_MS) return "live";
  if (lane.lastT) return "stale";
  if (lane.present) return "armed";
  return "idle";
}

export function latestTick(lane: PhosphorLane): PhosphorTick | null {
  if (!lane.ticks.length) return null;
  return lane.ticks[lane.ticks.length - 1];
}

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
  if (x <= padL) return { lane, tick: latestTick(lane), dist: 0 };
  const span = Math.max(1, state.t1 - state.t0);
  const t = state.t0 + ((x - padL) / Math.max(1, width - padL)) * span;
  const tick = selectTick(lane, t);
  if (!tick) return { lane, tick: null, dist: Infinity };
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
      present: l.present,
    })),
  });
}

export function xOf(state: PhosphorState, t: number, width: number, padL: number): number {
  const span = Math.max(1, state.t1 - state.t0);
  return padL + ((t - state.t0) / span) * (width - padL);
}
