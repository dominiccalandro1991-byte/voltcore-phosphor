import { useEffect, useRef } from "react";
import {
  hitTest,
  laneHasSignal,
  laneTone,
  xOf,
  type PhosphorLane,
  type PhosphorState,
} from "@/lib/voltcore/phosphor";
import { cn } from "@/lib/utils";

const PAD_L = 8;
const ROW = 22;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function toneClass(tone: string) {
  if (tone === "danger") return "text-danger";
  if (tone === "stale") return "text-warn";
  if (tone === "live" || tone === "armed") return "text-primary";
  return "text-muted";
}

export function PhosphorLattice({
  state,
  now,
  selectedLaneId,
  selectedId,
  onSelectLane,
  onSetScope,
}: {
  state: PhosphorState;
  now: number;
  selectedLaneId: string | null;
  selectedId: string | null;
  onSelectLane: (lane: PhosphorLane) => void;
  onSetScope: (tickId: string, lane: PhosphorLane) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bg = cssVar("--color-bg", "#07090c");
    const muted = cssVar("--color-subtle", "#5d7178");
    const primary = cssVar("--color-primary", "#00e5ff");
    const danger = cssVar("--color-danger", "#ff4d4d");
    const warn = cssVar("--color-warn", "#d4a017");

    const width = wrap.clientWidth;
    const height = Math.max(state.lanes.length * ROW, 240);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const span = Math.max(1, state.t1 - state.t0);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let m = 0; m <= 15; m++) {
      const t = state.t0 + (m / 15) * span;
      const x = xOf(state, t, width, PAD_L);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    state.lanes.forEach((lane, i) => {
      const y = i * ROW + ROW / 2;
      const tone = laneTone(lane, now);
      const color =
        tone === "danger" ? danger : tone === "stale" ? warn : tone === "live" || tone === "armed" ? primary : muted;
      if (selectedLaneId === lane.id) {
        ctx.fillStyle = "rgba(0, 229, 255, 0.08)";
        ctx.fillRect(0, i * ROW, width, ROW);
      } else if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.015)";
        ctx.fillRect(0, i * ROW, width, ROW);
      }
      ctx.strokeStyle = `${color}33`;
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      for (const tick of lane.ticks) {
        const x = xOf(state, tick.t, width, PAD_L);
        const age = Math.max(0, Math.min(1, 1 - (now - tick.t) / (15 * 60 * 1000)));
        const hot = /critical|fatal|high|error/i.test(tick.sev);
        ctx.globalAlpha = 0.35 + age * 0.65;
        ctx.fillStyle = hot ? danger : primary;
        const w = selectedId === tick.id ? 5 : 2;
        ctx.fillRect(x - w / 2, y - 6, w, 12);
        ctx.globalAlpha = 1;
      }
    });

    const playX = xOf(state, state.t1, width, PAD_L);
    ctx.strokeStyle = primary;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [state, now, selectedId, selectedLaneId]);

  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTest(state, x, y, rect.width, ROW, PAD_L);
    if (!hit) return;
    onSelectLane(hit.lane);
    if (hit.tick?.id) onSetScope(hit.tick.id, hit.lane);
  }

  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)]">
      <nav
        className="max-h-[70vh] overflow-y-auto border-r border-border bg-raised"
        aria-label="Fleet lanes"
      >
        {state.lanes.map((lane) => {
          const tone = laneTone(lane, now);
          const active = selectedLaneId === lane.id;
          return (
            <button
              key={lane.id}
              type="button"
              onClick={() => onSelectLane(lane)}
              className={cn(
                "flex min-h-10 w-full items-center gap-2 border-b border-border px-2 text-left font-mono text-xs",
                active ? "bg-primary/10 text-primary" : "text-fg",
              )}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full bg-current", toneClass(tone))} />
              <span className="truncate">{lane.id}</span>
              {laneHasSignal(lane) ? (
                <span className={cn("ml-auto font-mono text-[0.65rem] uppercase", toneClass(tone))}>
                  {tone}
                </span>
              ) : (
                <span className="ml-auto text-subtle">idle</span>
              )}
            </button>
          );
        })}
      </nav>
      <div ref={wrapRef} className="relative min-h-[240px] min-w-0 overflow-x-auto">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          onPointerDown={pointer}
          role="img"
          aria-label="Phosphor lattice of fleet event traces"
        />
      </div>
    </div>
  );
}
