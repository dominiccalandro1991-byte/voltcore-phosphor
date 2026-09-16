import { useMemo, useState } from "react";
import { Crosshair, Radio, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fireMonday, pingFleet } from "@/lib/voltcore/server-fns";
import { isAnomaly } from "@/lib/voltcore/anomaly";
import { LANE_CEILING } from "@/lib/voltcore/fleet";
import { ago, previewPayload } from "@/lib/voltcore/format";
import {
  hydratePhosphor,
  laneHasSignal,
  latestTick,
  type PhosphorLane,
} from "@/lib/voltcore/phosphor";
import { latticeIds, remediateOnTrunk, TRUNK_ORIGIN } from "@/lib/voltcore/trunk";
import { cn } from "@/lib/utils";
import type { CommandCenterSnapshot, VoltEvent } from "@/lib/voltcore/types";
import { PhosphorLattice } from "./lattice";
import { useLive } from "./use-live";

const PULSE_PRESETS = ["Mesh HMAC rotation", "Radar feed timeout", "SEV-1 edge outage", "GPS accuracy drift"];

export function CommandCenter({ initial }: { initial: CommandCenterSnapshot }) {
  const { snap, link, now, refresh } = useLive(initial);
  const [pulse, setPulse] = useState(PULSE_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [remediate, setRemediate] = useState<{
    event: VoltEvent;
    status: string;
    summary?: string;
    patch?: string;
    model?: string;
  } | null>(null);

  const phosphor = useMemo(
    () => hydratePhosphor(snap.events, latticeIds(snap.fleet), now),
    [snap.events, snap.fleet, now],
  );

  const selectedLane = phosphor.lanes.find((l) => l.id === selectedLaneId) ?? null;

  const focused: VoltEvent | null = useMemo(() => {
    if (focusId) {
      const hit = snap.events.find((e) => e.id === focusId);
      if (hit) return hit;
    }
    if (selectedLaneId) {
      return snap.events.find((e) => e.source === selectedLaneId) ?? null;
    }
    return null;
  }, [focusId, selectedLaneId, snap.events]);

  const signalN = phosphor.lanes.filter(laneHasSignal).length;
  const latestRun = snap.runs[0] || null;

  function selectLane(lane: PhosphorLane) {
    setSelectedLaneId(lane.id);
    const tick = latestTick(lane);
    if (tick?.id) setFocusId(tick.id);
    else {
      const ev = snap.events.find((e) => e.source === lane.id);
      setFocusId(ev?.id ?? null);
    }
  }

  function setScope(tickId: string, lane: PhosphorLane) {
    setSelectedLaneId(lane.id);
    setFocusId(tickId);
  }

  async function dispatchPulse() {
    setBusy(true);
    try {
      await fireMonday({ data: { pulseName: pulse } });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function pingAll() {
    setBusy(true);
    try {
      await pingFleet({ data: { action: "ping-all", source: "voltcore-command-center" } });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function openRemediate(ev: VoltEvent) {
    setRemediate({ event: ev, status: "Asking Dual-Rail trunk…" });
    try {
      const data = await remediateOnTrunk(ev);
      setRemediate({
        event: ev,
        status: "",
        summary: data.summary,
        patch: data.patch,
        model: data.model,
      });
    } catch (err) {
      setRemediate({ event: ev, status: err instanceof Error ? err.message : "Remediate failed" });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 pt-[max(0.55rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-widest text-primary">VOLTCORE // PHOSPHOR</p>
            <h1 className="truncate text-lg font-medium tracking-tight">Lattice oscilloscope</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-3 font-mono text-xs",
                link === "offline" ? "border-danger/40 text-danger" : "border-primary/40 bg-primary/10 text-primary",
              )}
            >
              <span className={cn("mr-2 size-1.5 rounded-full bg-current", link !== "offline" && "live-dot")} />
              {link === "syncing" ? "SYNC" : link === "live" ? "LIVE" : "OFF"}
            </span>
            <Button size="icon" variant="secondary" aria-label="Refresh" onClick={() => void refresh()}>
              <RefreshCw className={cn("size-4", link === "syncing" && "animate-spin")} />
            </Button>
          </div>
        </div>
        <dl className="flex gap-4 overflow-x-auto px-4 pb-2 font-mono text-xs text-muted">
          <div>
            <dt className="inline text-subtle">LANES </dt>
            <dd className="inline text-fg">
              {signalN}/{LANE_CEILING}
            </dd>
          </div>
          <div>
            <dt className="inline text-subtle">SCOPE </dt>
            <dd className="inline text-fg">{selectedLane?.id ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-subtle">TRUNK </dt>
            <dd className="inline text-fg">
              {snap.fleet.supabase ? "sb" : "—"} {snap.fleet.openrouter ? "or" : ""} {snap.fleet.mesh ? "mesh" : ""}
            </dd>
          </div>
          <div>
            <dt className="inline text-subtle">WINDOW </dt>
            <dd className="inline text-fg">15m</dd>
          </div>
        </dl>
      </header>

      <section className="border-b border-border bg-surface">
        <PhosphorLattice
          state={phosphor}
          now={now}
          selectedLaneId={selectedLaneId}
          selectedId={focused?.id ?? null}
          onSelectLane={selectLane}
          onSetScope={setScope}
        />
      </section>

      <main className="grid flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="border-b border-border p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crosshair className="size-4 text-primary" />
              <h2 className="text-base font-medium">Scope</h2>
            </div>
            {focused && isAnomaly(focused.severity) ? (
              <Button variant="danger" onClick={() => void openRemediate(focused)}>
                <ShieldAlert className="size-4" /> Remediate
              </Button>
            ) : null}
          </div>
          {focused ? (
            <div className="mt-3 space-y-2">
              <p className="font-mono text-xs text-muted">
                {focused.source} · {focused.event_type} · {ago(focused.created_at, now)}
              </p>
              <pre className="max-h-48 overflow-auto rounded-xl bg-raised p-3 font-mono text-xs whitespace-pre-wrap break-words">
                {previewPayload(focused.payload)}
              </pre>
            </div>
          ) : selectedLane ? (
            <p className="mt-4 text-sm text-muted">
              Lane {selectedLane.id} — {selectedLane.repo || "no repo map"}. No event in window.
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">Click a lane or a phosphor tick.</p>
          )}

          {latestRun ? (
            <div className="mt-4 rounded-xl border border-border bg-raised p-3">
              <p className="font-mono text-xs tracking-widest text-primary">DUAL-RAIL</p>
              <p className="mt-1 text-sm">{latestRun.fused_summary || "Awaiting consensus"}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                score {latestRun.consensus_score ?? "—"} · {latestRun.winner_model || "no winner"}
              </p>
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-3 p-4">
          <p className="font-mono text-xs tracking-widest text-muted">INGRESS</p>
          <div className="flex flex-wrap gap-2">
            {PULSE_PRESETS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setPulse(name)}
                className={cn(
                  "min-h-10 rounded-full border px-3 font-mono text-xs",
                  pulse === name ? "border-primary bg-primary/10 text-primary" : "border-border text-muted",
                )}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <input
              value={pulse}
              onChange={(e) => setPulse(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg"
              placeholder="Pulse name"
            />
            <Button variant="primary" onClick={() => void dispatchPulse()} disabled={busy || !pulse.trim()}>
              <Send className="size-4" />
              {busy ? "Dispatching" : "Dispatch pulse"}
            </Button>
            <Button variant="ghost" onClick={() => void pingAll()} disabled={busy}>
              <Radio className="size-4" /> Ping fleet
            </Button>
          </div>
          <p className="font-mono text-xs text-subtle break-all">{TRUNK_ORIGIN.replace("https://", "")}</p>
        </aside>
      </main>

      {remediate ? (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-bg/70" aria-label="Close" onClick={() => setRemediate(null)} />
          <section className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-2xl border border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-auto sm:right-4 sm:top-1/2 sm:w-[28rem] sm:-translate-y-1/2 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs tracking-widest text-primary">REMEDIATE</p>
                <h2 className="text-base font-medium">{remediate.event.source}</h2>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setRemediate(null)} aria-label="Close">
                ×
              </Button>
            </div>
            {remediate.status ? <p className="mt-3 font-mono text-xs text-muted">{remediate.status}</p> : null}
            {remediate.model ? <p className="mt-2 font-mono text-xs text-muted">{remediate.model}</p> : null}
            {remediate.summary ? <p className="mt-3 text-sm leading-snug">{remediate.summary}</p> : null}
            {remediate.patch ? (
              <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-bg p-3 font-mono text-xs whitespace-pre-wrap break-words">
                {remediate.patch}
              </pre>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
