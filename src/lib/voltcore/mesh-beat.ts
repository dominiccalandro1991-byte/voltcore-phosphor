import { DEPRECATED_LANES, FLEET } from "./fleet";
import { TRUNK_ORIGIN } from "./trunk";
import type { VoltEvent } from "./types";

const URL = `${TRUNK_ORIGIN}/api/v1/events`;
export const BEAT_MS = 60_000;
const FRESH_MS = 90_000;
const BANNED = new Set<string>(DEPRECATED_LANES);

/**
 * Construction-target diagnostics. Trunk Cloudflare cron is the source of truth.
 * This module is retained as a manual/debug emitter only — the Phosphor UI
 * no longer runs a 60s client telemetry loop.
 */
export const INCOMPLETE: Record<
  string,
  { missing_dependencies: string[]; required_build_specs: string[] }
> = {
  causalrail: {
    missing_dependencies: [],
    required_build_specs: [
      "package.json with type:module",
      "voltcore/heartbeat.mjs POSTing source=causalrail type=health.heartbeat every 60s",
    ],
  },
  "paleochron-arrowforge": {
    missing_dependencies: [],
    required_build_specs: [
      "seed application source on main",
      "voltcore/heartbeat.mjs POSTing source=paleochron-arrowforge type=health.heartbeat every 60s",
    ],
  },
};

export async function postLaneBeat(source: string): Promise<boolean> {
  if (BANNED.has(source)) return false;
  const spec = FLEET[source];
  const diag = INCOMPLETE[source];
  const incomplete = Boolean(diag);
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        type: incomplete ? "health.diagnostic" : "health.heartbeat",
        severity: "info",
        payload: {
          status: incomplete ? "incomplete" : "live",
          surface: "phosphor",
          interval_s: 60,
          repo: spec?.repo ?? null,
          incomplete,
          missing_dependencies: diag?.missing_dependencies ?? [],
          required_build_specs: diag?.required_build_specs ?? [],
          ts: Date.now(),
        },
      }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** @deprecated Trunk cron pollFleet is the source of truth. */
export async function beatMissingLanes(events: VoltEvent[]): Promise<number> {
  const now = Date.now();
  const fresh = new Set(
    events
      .filter((e) => now - new Date(e.created_at).getTime() < FRESH_MS)
      .map((e) => e.source),
  );
  let n = 0;
  for (const source of Object.keys(FLEET)) {
    if (BANNED.has(source)) continue;
    if (fresh.has(source)) continue;
    if (await postLaneBeat(source)) n += 1;
  }
  return n;
}
