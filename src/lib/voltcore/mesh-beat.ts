import { FLEET } from "./fleet";
import { TRUNK_ORIGIN } from "./trunk";
import type { VoltEvent } from "./types";

const URL = `${TRUNK_ORIGIN}/api/v1/events`;
export const BEAT_MS = 60_000;
const FRESH_MS = 90_000;

/** Repos with no runnable app — payload is the diagnostic, not a fake live tick. */
export const INCOMPLETE: Record<
  string,
  { missing_dependencies: string[]; required_build_specs: string[] }
> = {
  "asml-nexus": {
    missing_dependencies: ["source tree", "package.json"],
    required_build_specs: ["seed ASML nexus app", "npm run build"],
  },
  "VOLTCORE-IdeaForge": {
    missing_dependencies: ["runtime manifest (package.json | index.html)"],
    required_build_specs: ["define a build entry"],
  },
  causalrail: {
    missing_dependencies: ["runtime manifest (package.json | index.html)"],
    required_build_specs: ["define a build entry"],
  },
  "paleochron-arrowforge": {
    missing_dependencies: ["source tree"],
    required_build_specs: ["seed application source on main"],
  },
};

export async function postLaneBeat(source: string): Promise<boolean> {
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

/** POST only lanes with no event in the last 90s. Sequential to avoid a stampede. */
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
