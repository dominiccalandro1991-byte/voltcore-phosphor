export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type JsonMap = { [key: string]: Json };

export const SEVERITIES = ["info", "ok", "warn", "error", "high", "critical", "fatal"] as const;
export type Severity = (typeof SEVERITIES)[number] | string;

export type AnomalyKind = "none" | "active" | "aged" | "resolved";

export type TelemetryChannel =
  | "ingress"
  | "inference"
  | "consensus"
  | "mesh"
  | "heal"
  | "pipeline";

export type RailStatus = "idle" | "pending" | "fulfilled" | "rejected" | "offline";

export interface FleetSource {
  id: string;
  label: string;
  group: string;
  groupLabel: string;
}

export interface VoltEvent {
  id: string;
  created_at: string;
  source: string;
  event_type: string;
  severity: string;
  payload: JsonMap;
  correlation_id: string | null;
}

export interface TelemetryRow {
  id: string;
  created_at: string;
  correlation_id: string;
  channel: string;
  model: string | null;
  status: string;
  latency_ms: number | null;
  source: string | null;
  metric: JsonMap;
}

export interface InferenceRun {
  id: string;
  created_at: string;
  correlation_id: string;
  prompt: string;
  consensus_score: number | null;
  winner_model: string | null;
  fused_summary: string | null;
  models: InferenceResult[];
}

export interface InferenceResult {
  model: string;
  rail: "neural" | "symbolic" | "secondary";
  status: "fulfilled" | "rejected";
  latency_ms: number;
  text?: string;
  reason?: string;
  tokens?: number;
}

export interface ConsensusReport {
  score: number;
  winnerModel: string | null;
  fusedSummary: string;
  dissent: string[];
  jaccard: number;
  rails: InferenceResult[];
}

export interface MondayEvent {
  boardId?: number;
  pulseId?: number;
  pulseName?: string;
  columnId?: string;
  value?: Json;
  type?: string;
  userId?: number;
}

export interface MondayWebhookPayload {
  challenge?: string;
  event?: MondayEvent;
  type?: string;
}

export interface FleetSnapshot {
  status: "ok";
  fleet: string[];
  mesh: boolean;
  trunk: boolean;
  neural: boolean;
  openrouter: boolean;
  supabase: boolean;
}

export interface CommandCenterSnapshot {
  events: VoltEvent[];
  telemetry: TelemetryRow[];
  runs: InferenceRun[];
  fleet: FleetSnapshot;
  fetched_at: string;
}
