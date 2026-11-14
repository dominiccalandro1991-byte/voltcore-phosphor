import type { FleetSource } from "./types";

/** Permanently purged. Never reintroduced as lattice keys. */
export const DEPRECATED_LANES = ["asml-nexus", "VOLTCORE-IdeaForge"] as const;

export const LANE_CEILING = 46;

type Rail = "edge" | "trunk" | "product" | "studio";

type LaneSpec = {
  repo: string;
  paths: string[];
  group: string;
  groupLabel: string;
  rail: Rail;
};

function lane(
  repo: string,
  group: string,
  groupLabel: string,
  rail: Rail,
  paths: string[] = ["src/"],
): LaneSpec {
  return { repo, paths, group, groupLabel, rail };
}

/**
 * One key per active GitHub repository across dominiccalandro1991-byte and voltcore-org.
 * Cross-org name collisions are disambiguated. Alias lanes (monday, nano-cloud,
 * command_center.remediate, grok-orchestration-engine) are not keys — they fold
 * onto the owning repo at ingest.
 */
export const FLEET: Record<string, LaneSpec> = {
  "core-api": lane("dominiccalandro1991-byte/core-api", "trunk", "Dual-Rail Trunk", "trunk"),
  "core-api-org": lane("voltcore-org/core-api", "trunk", "Dual-Rail Trunk", "trunk"),

  "storm-path": lane("voltcore-org/storm-path", "storm", "Storm Path", "edge", ["telemetry.js", "index.html"]),
  "storm-path-web": lane("voltcore-org/storm-path-web", "storm", "Storm Path", "edge", ["index.html"]),
  "storm-path-web-byte": lane("dominiccalandro1991-byte/storm-path-web", "storm", "Storm Path", "edge"),
  "storm-path-mobile": lane("voltcore-org/storm-path-mobile", "storm", "Storm Path", "edge"),
  "storm-path-app": lane("dominiccalandro1991-byte/storm-path-app", "storm", "Storm Path", "edge"),

  "nano-sandbox": lane("voltcore-org/nano-sandbox", "nano", "Nano Mesh", "edge", ["backend/app/", "public/"]),
  "snca-codec": lane("voltcore-org/snca-codec", "nano", "Nano Mesh", "edge"),

  "voltcore-command-center": lane("voltcore-org/voltcore-command-center", "command", "Command", "trunk", ["app.js", "index.html"]),
  "voltcore-code-agent": lane("dominiccalandro1991-byte/voltcore-code-agent", "command", "Command", "trunk"),
  "voltcore-anvil": lane("dominiccalandro1991-byte/voltcore-anvil", "command", "Command", "trunk"),
  "voltcore-phosphor": lane("dominiccalandro1991-byte/voltcore-phosphor", "command", "Command", "trunk"),
  "raft-command-center": lane("dominiccalandro1991-byte/raft-command-center", "command", "Command", "trunk"),
  "raft-command-center-webgl": lane("dominiccalandro1991-byte/raft-command-center-webgl", "command", "Command", "trunk"),

  trueturn: lane("dominiccalandro1991-byte/TrueTurn", "kinetic", "Kinetic", "product", ["src/", "public/"]),
  "trueturn-org": lane("voltcore-org/TrueTurn", "kinetic", "Kinetic", "product"),
  aetherion: lane("voltcore-org/Aetherion", "kinetic", "Kinetic", "product"),
  "voltcore-asml": lane("voltcore-org/voltcore-asml", "kinetic", "Kinetic", "product"),
  "conways-game-of-life": lane("voltcore-org/conways-game-of-life", "kinetic", "Kinetic", "product"),
  "paleochron-arrowforge": lane("voltcore-org/paleochron-arrowforge", "kinetic", "Kinetic", "product", ["index.html"]),
  "paleochron-arrowforge-byte": lane("dominiccalandro1991-byte/paleochron-arrowforge", "kinetic", "Kinetic", "product"),
  "enclosed-raft-sim": lane("voltcore-org/enclosed-raft-sim", "kinetic", "Kinetic", "product"),

  aeroframe: lane("voltcore-org/aeroframe", "envelope", "Envelope", "product"),
  "aeroframe-byte": lane("dominiccalandro1991-byte/aeroframe", "envelope", "Envelope", "product"),
  "stratospheric-a300": lane("voltcore-org/stratospheric-a300", "envelope", "Envelope", "product"),
  "stratospheric-a300-byte": lane("dominiccalandro1991-byte/stratospheric-a300", "envelope", "Envelope", "product"),
  "NEXUSFLOW-ENGINE": lane("dominiccalandro1991-byte/NEXUSFLOW-ENGINE", "envelope", "Envelope", "product"),
  "OMNIAGENT-MATRIX": lane("dominiccalandro1991-byte/OMNIAGENT-MATRIX", "envelope", "Envelope", "product"),

  causalrail: lane("voltcore-org/causalrail", "ops", "Ops", "edge", ["client/", "server/", "voltcore/", "package.json"]),
  "orbit-life-operator": lane("dominiccalandro1991-byte/orbit-life-operator", "ops", "Ops", "product"),
  "apexline-revenue-dashboard": lane("dominiccalandro1991-byte/apexline-revenue-dashboard", "ops", "Ops", "product"),
  "leadmorph-engine": lane("dominiccalandro1991-byte/leadmorph-engine", "ops", "Ops", "product"),
  "kite-zest-acre-fjord": lane("dominiccalandro1991-byte/kite-zest-acre-fjord", "ops", "Ops", "edge"),
  helixar: lane("voltcore-org/helixar", "ops", "Ops", "edge"),

  "vc010-five-artists-engine": lane("voltcore-org/vc010-five-artists-engine", "studio", "Studio", "studio", ["index.html"]),
  "daily-ignition": lane("dominiccalandro1991-byte/daily-ignition", "studio", "Studio", "studio", ["index.html"]),
  "daily-ignition-sober-stack": lane("dominiccalandro1991-byte/daily-ignition-sober-stack", "studio", "Studio", "studio", ["index.html"]),
  lumenarchive: lane("dominiccalandro1991-byte/lumenarchive", "studio", "Studio", "studio"),
  "lumen-archive-core": lane("dominiccalandro1991-byte/lumen-archive-core", "studio", "Studio", "studio"),
  "lovable-engine-core": lane("dominiccalandro1991-byte/lovable-engine-core", "studio", "Studio", "studio"),
  "dream-canvas-pro-8d31b443": lane("voltcore-org/dream-canvas-pro-8d31b443", "studio", "Studio", "studio"),
  "Prototype-1": lane("voltcore-org/Prototype-1", "studio", "Studio", "studio"),

  "byte-forge": lane("dominiccalandro1991-byte/byte-forge", "forge", "Forge", "product"),
  "backroads-agent": lane("dominiccalandro1991-byte/backroads-agent", "forge", "Forge", "product"),
  "codeforge-language-lab": lane("dominiccalandro1991-byte/codeforge-language-lab", "forge", "Forge", "product"),
};

export const FLEET_GROUPS = [
  { id: "trunk", label: "Dual-Rail Trunk", sources: ["core-api", "core-api-org"] },
  {
    id: "storm",
    label: "Storm Path",
    sources: ["storm-path", "storm-path-web", "storm-path-web-byte", "storm-path-mobile", "storm-path-app"],
  },
  { id: "nano", label: "Nano Mesh", sources: ["nano-sandbox", "snca-codec"] },
  {
    id: "command",
    label: "Command",
    sources: [
      "voltcore-command-center",
      "voltcore-code-agent",
      "voltcore-anvil",
      "voltcore-phosphor",
      "raft-command-center",
      "raft-command-center-webgl",
    ],
  },
  {
    id: "kinetic",
    label: "Kinetic",
    sources: [
      "trueturn",
      "trueturn-org",
      "aetherion",
      "voltcore-asml",
      "conways-game-of-life",
      "paleochron-arrowforge",
      "paleochron-arrowforge-byte",
      "enclosed-raft-sim",
    ],
  },
  {
    id: "envelope",
    label: "Envelope",
    sources: [
      "aeroframe",
      "aeroframe-byte",
      "stratospheric-a300",
      "stratospheric-a300-byte",
      "NEXUSFLOW-ENGINE",
      "OMNIAGENT-MATRIX",
    ],
  },
  {
    id: "ops",
    label: "Ops",
    sources: [
      "causalrail",
      "orbit-life-operator",
      "apexline-revenue-dashboard",
      "leadmorph-engine",
      "kite-zest-acre-fjord",
      "helixar",
    ],
  },
  {
    id: "studio",
    label: "Studio",
    sources: [
      "vc010-five-artists-engine",
      "daily-ignition",
      "daily-ignition-sober-stack",
      "lumenarchive",
      "lumen-archive-core",
      "lovable-engine-core",
      "dream-canvas-pro-8d31b443",
      "Prototype-1",
    ],
  },
  {
    id: "forge",
    label: "Forge",
    sources: ["byte-forge", "backroads-agent", "codeforge-language-lab"],
  },
] as const;

/** Legacy source strings that are not repositories. Fold onto the owning lane. */
export const LANE_ALIAS: Record<string, string> = {
  monday: "voltcore-command-center",
  "nano-cloud": "snca-codec",
  "command_center.remediate": "voltcore-command-center",
  "grok-orchestration-engine": "voltcore-command-center",
};

const purged = new Set<string>(DEPRECATED_LANES);
const seenRepo = new Set<string>();
const seenId = new Set<string>();
for (const group of FLEET_GROUPS) {
  for (const id of group.sources) {
    const spec = FLEET[id];
    if (!spec) throw new Error(`lattice group references missing lane ${id}`);
    if (seenId.has(id)) throw new Error(`lattice lane duplicated ${id}`);
    if (purged.has(id) || purged.has(spec.repo.split("/")[1] || "")) {
      throw new Error(`purged lane reintroduced ${id}`);
    }
    if (seenRepo.has(spec.repo)) throw new Error(`lattice repo not MECE ${spec.repo}`);
    seenId.add(id);
    seenRepo.add(spec.repo);
  }
}
for (const id of Object.keys(FLEET)) {
  if (!seenId.has(id)) throw new Error(`lattice lane outside groups ${id}`);
}
if (seenId.size !== LANE_CEILING) {
  throw new Error(`lattice cardinality ${seenId.size} != ${LANE_CEILING}`);
}

export const ANOMALY = new Set(["critical", "fatal", "high", "error"]);
export const RESOLVED_STATUS = new Set(["patched", "recovered", "resolved", "ok"]);
export const ANOMALY_TTL_MS = 6 * 60 * 60 * 1000;
export const STALE_MS = 3 * 60 * 1000;
export const FORBID = /(\.env($|\.)|secrets?\/|credentials|id_rsa|ghp_|service_role|wrangler\.toml)/i;
export const MAX_PATCH = 80_000;
export const HEAL_WINDOW_MS = 60 * 60 * 1000;
export const HEAL_CAP = 3;

export function fleetSources(): FleetSource[] {
  return Object.entries(FLEET).map(([id, spec]) => ({
    id,
    label: id,
    group: spec.group,
    groupLabel: spec.groupLabel,
  }));
}

/** MECE ingest contract: POST /api/v1/events with source = lane id. */
export const INGEST_CONTRACT = {
  method: "POST",
  path: "/api/v1/events",
  source: "lane id from FLEET keys",
  event_type: "health.heartbeat | anomaly | monday.ingested | …",
  batch: "JSON array or { events: [...] } — one PostgREST insert",
} as const;
