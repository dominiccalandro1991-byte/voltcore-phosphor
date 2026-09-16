import { FLEET } from "./fleet";
import { TRUNK_ORIGIN } from "./trunk";
import type { VoltEvent } from "./types";

const URL = `${TRUNK_ORIGIN}/api/v1/events`;
export const BEAT_MS = 60_000;
const FRESH_MS = 90_000;

/** Construction targets only. Deprecated lanes are not listed. */
export const INCOMPLETE: Record<
  string,
  { missing_dependencies: string[]; required_build_specs: string[] }
> = {
  causalrail: {
    missing_dependencies: ["runtime manifest (package.json | index.html)", "src tree"],
    required_build_specs: [
      "package.json with type:module",
      "npm run build or static index.html",
      "voltcore/heartbeat.mjs POSTing source=causalrail type=health.heartbeat every 60s",
    ],
  },
  "paleochron-arrowforge": {
    missing_dependencies: ["source tree (repo size 0)", "package.json", "index.html"],
    required_build_specs: [
      "seed application source on main",
      "Expo/PWA lithic ID suite as described in repo metadata",
      "voltcore/heartbeat.mjs POSTing source=paleochron-arrowforge type=health.heartbeat every 60s",
    ],
  },
};

export async function postLaneBeat(source: string): Promise<boolean> {
  if (source === "asml-nexus" || source === "VOLTCORE-IdeaForge") return false;
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
        severity: incomplete ? "warn" : "info",
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

export async function beatMissingLanes(events: VoltEvent[]): Promise<number> {
  const now = Date.now();
  const fresh = new Set(
    events
      .filter((e) => now - new Date(e.created_at).getTime() < FRESH_MS)
      .map((e) => e.source),
  );
  let n = 0;
  for (const source of Object.keys(FLEET)) {
    if (fresh.has(source)) continue;
    if (await postLaneBeat(source)) n += 1;
  }
  return n;
}
