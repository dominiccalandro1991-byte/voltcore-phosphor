import { useEffect, useRef } from "react";
import {
  hitTest,
  laneTone,
  xOf,
  type PhosphorHit,
  type PhosphorState,
} from "@/lib/voltcore/phosphor";

const PAD_L = 132;
const ROW = 22;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function PhosphorLattice({
  state,
  now,
  selectedId,
  onHit,
}: {
  state: PhosphorState;
  now: number;
  selectedId: string | null;
  onHit: (hit: PhosphorHit) => void;
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
    const raised = cssVar("--color-raised", "#161d26");
    const muted = cssVar("--color-subtle", "#5d7178");
    const primary = cssVar("--color-primary", "#00e5ff");
    const danger = cssVar("--color-danger", "#ff4d4d");
    const warn = cssVar("--color-warn", "#d4a017");
    const fg = cssVar("--color-fg", "#e8f0f2");

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

    ctx.fillStyle = raised;
    ctx.fillRect(0, 0, PAD_L, height);

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

    ctx.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";

    state.lanes.forEach((lane, i) => {
      const y = i * ROW + ROW / 2;
      const tone = laneTone(lane, now);
      const color =
        tone === "danger" ? danger : tone === "stale" ? warn : tone === "live" ? primary : muted;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent";
      ctx.fillRect(PAD_L, i * ROW, width - PAD_L, ROW);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(10, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.fillText(lane.id.slice(0, 18), 18, y);
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
  }, [state, now, selectedId]);

  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTest(state, x, y, rect.width, ROW, PAD_L);
    if (hit && hit.tick.id) onHit(hit);
  }

  return (
    <div ref={wrapRef} className="relative min-h-[240px] w-full overflow-x-auto">
      <canvas
        ref={canvasRef}
        className="block w-full cursor-crosshair"
        onPointerDown={pointer}
        role="img"
        aria-label="Phosphor lattice of fleet event traces"
      />
    </div>
  );
}
