import type { FleetSource } from "./types";

export const FLEET: Record<
  string,
  { repo: string; paths: string[]; group: string; groupLabel: string; rail: "edge" | "trunk" | "product" | "studio" }
> = {
  "core-api": {
    repo: "dominiccalandro1991-byte/core-api",
    paths: ["src/"],
    group: "trunk",
    groupLabel: "Dual-Rail Trunk",
    rail: "trunk",
  },
  "storm-path": {
    repo: "voltcore-org/storm-path",
    paths: ["telemetry.js", "index.html"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "storm-path-web": {
    repo: "voltcore-org/storm-path-web",
    paths: ["telemetry.js"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "storm-path-mobile": {
    repo: "voltcore-org/storm-path-mobile",
    paths: ["src/"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "storm-path-app": {
    repo: "dominiccalandro1991-byte/storm-path-app",
    paths: ["src/"],
    group: "storm",
    groupLabel: "Storm Path",
    rail: "edge",
  },
  "nano-sandbox": {
    repo: "voltcore-org/nano-sandbox",
    paths: ["backend/app/", "public/"],
    group: "nano",
    groupLabel: "Nano Mesh",
    rail: "edge",
  },
  "snca-codec": {
    repo: "voltcore-org/snca-codec",
    paths: ["src/"],
    group: "nano",
    groupLabel: "Nano Mesh",
    rail: "edge",
  },
  "nano-cloud": {
    repo: "voltcore-org/snca-codec",
    paths: ["src/"],
    group: "nano",
    groupLabel: "Nano Mesh",
    rail: "edge",
  },
  "voltcore-command-center": {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["app.js", "index.html"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "command_center.remediate": {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["app.js"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "grok-orchestration-engine": {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["app.js"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  monday: {
    repo: "voltcore-org/voltcore-command-center",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "voltcore-code-agent": {
    repo: "dominiccalandro1991-byte/voltcore-code-agent",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "voltcore-anvil": {
    repo: "dominiccalandro1991-byte/voltcore-anvil",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  "voltcore-phosphor": {
    repo: "dominiccalandro1991-byte/voltcore-phosphor",
    paths: ["src/"],
    group: "command",
    groupLabel: "Command",
    rail: "trunk",
  },
  trueturn: {
    repo: "dominiccalandro1991-byte/TrueTurn",
    paths: ["src/", "public/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  aetherion: {
    repo: "voltcore-org/Aetherion",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "voltcore-asml": {
    repo: "voltcore-org/voltcore-asml",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "asml-nexus": {
    repo: "dominiccalandro1991-byte/asml-nexus",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "conways-game-of-life": {
    repo: "voltcore-org/conways-game-of-life",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "paleochron-arrowforge": {
    repo: "voltcore-org/paleochron-arrowforge",
    paths: ["src/"],
    group: "kinetic",
    groupLabel: "Kinetic",
    rail: "product",
  },
  "vc010-five-artists-engine": {
    repo: "voltcore-org/vc010-five-artists-engine",
    paths: ["index.html"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  causalrail: {
    repo: "voltcore-org/causalrail",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "edge",
  },
  "orbit-life-operator": {
    repo: "dominiccalandro1991-byte/orbit-life-operator",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "product",
  },
  "apexline-revenue-dashboard": {
    repo: "dominiccalandro1991-byte/apexline-revenue-dashboard",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "product",
  },
  "leadmorph-engine": {
    repo: "dominiccalandro1991-byte/leadmorph-engine",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "product",
  },
  "daily-ignition": {
    repo: "dominiccalandro1991-byte/daily-ignition",
    paths: ["index.html"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "daily-ignition-sober-stack": {
    repo: "dominiccalandro1991-byte/daily-ignition-sober-stack",
    paths: ["index.html"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  lumenarchive: {
    repo: "dominiccalandro1991-byte/lumenarchive",
    paths: ["src/"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "lumen-archive-core": {
    repo: "dominiccalandro1991-byte/lumen-archive-core",
    paths: ["src/"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "lovable-engine-core": {
    repo: "dominiccalandro1991-byte/lovable-engine-core",
    paths: ["src/"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "VOLTCORE-IdeaForge": {
    repo: "dominiccalandro1991-byte/VOLTCORE-IdeaForge",
    paths: ["src/"],
    group: "studio",
    groupLabel: "Studio",
    rail: "studio",
  },
  "kite-zest-acre-fjord": {
    repo: "dominiccalandro1991-byte/kite-zest-acre-fjord",
    paths: ["src/"],
    group: "ops",
    groupLabel: "Ops",
    rail: "edge",
  },
};

export const FLEET_GROUPS = [
  {
    id: "trunk",
    label: "Dual-Rail Trunk",
    sources: ["core-api"],
  },
  {
    id: "storm",
    label: "Storm Path",
    sources: ["storm-path", "storm-path-web", "storm-path-mobile", "storm-path-app"],
  },
  {
    id: "nano",
    label: "Nano Mesh",
    sources: ["nano-sandbox", "snca-codec", "nano-cloud"],
  },
  {
    id: "command",
    label: "Command",
    sources: [
      "voltcore-command-center",
      "command_center.remediate",
      "grok-orchestration-engine",
      "monday",
      "voltcore-code-agent",
      "voltcore-anvil",
      "voltcore-phosphor",
    ],
  },
  {
    id: "kinetic",
    label: "Kinetic",
    sources: [
      "trueturn",
      "aetherion",
      "voltcore-asml",
      "asml-nexus",
      "conways-game-of-life",
      "paleochron-arrowforge",
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
      "VOLTCORE-IdeaForge",
    ],
  },
] as const;

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
} as const;
