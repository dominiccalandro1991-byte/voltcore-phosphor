import { useCallback, useEffect, useRef, useState } from "react";
import { getSnapshot } from "@/lib/voltcore/server-fns";
import { mergeSnapshot, pullTrunkEvents, pullTrunkHealth } from "@/lib/voltcore/trunk";
import type { CommandCenterSnapshot, InferenceRun, TelemetryRow, VoltEvent } from "@/lib/voltcore/types";

function mergeById<T extends { id: string }>(prev: T[], incoming: T[], cap: number): T[] {
  const map = new Map<string, T>();
  for (const row of incoming) map.set(row.id, row);
  for (const row of prev) if (!map.has(row.id)) map.set(row.id, row);
  return [...map.values()]
    .sort((a, b) =>
      String((b as { created_at?: string }).created_at).localeCompare(
        String((a as { created_at?: string }).created_at),
      ),
    )
    .slice(0, cap);
}

export function useLive(initial: CommandCenterSnapshot) {
  const [snap, setSnap] = useState(initial);
  const [link, setLink] = useState<"live" | "syncing" | "offline">("live");
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date(initial.fetched_at).getTime() || Date.now());
  const seen = useRef(new Set(initial.events.map((e) => e.id)));
  const sseOk = useRef(false);
  const eventsRef = useRef(initial.events);

  const apply = useCallback((next: CommandCenterSnapshot, markFresh: boolean) => {
    setSnap((prev) => {
      if (markFresh) {
        const fresh = new Set<string>();
        for (const ev of next.events) {
          if (!seen.current.has(ev.id)) fresh.add(ev.id);
        }
        if (fresh.size) {
          setFreshIds(fresh);
          window.setTimeout(() => setFreshIds(new Set()), 1600);
        }
      }
      seen.current = new Set(next.events.map((e) => e.id));
      eventsRef.current = next.events;
      return next;
    });
    setLink("live");
  }, []);

  const refresh = useCallback(async () => {
    setLink("syncing");
    try {
      const [local, trunkEvents, trunkFleet] = await Promise.all([
        getSnapshot(),
        pullTrunkEvents(150).catch(() => [] as VoltEvent[]),
        pullTrunkHealth().catch(() => null),
      ]);
      apply(mergeSnapshot(local, trunkEvents, trunkFleet), true);
    } catch {
      setLink("offline");
    }
  }, [apply]);

  useEffect(() => {
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/v1/stream");
      const bumpEvent = (ev: MessageEvent) => {
        sseOk.current = true;
        try {
          const row = JSON.parse(ev.data) as VoltEvent;
          if (!row?.id) return;
          setSnap((prev) => {
            const events = mergeById(prev.events, [row], 150);
            eventsRef.current = events;
            return {
              ...prev,
              events,
              fetched_at: new Date().toISOString(),
            };
          });
          if (!seen.current.has(row.id)) {
            seen.current.add(row.id);
            setFreshIds(new Set([row.id]));
            window.setTimeout(() => setFreshIds(new Set()), 1600);
          }
        } catch {
          /* ignore malformed */
        }
      };
      es.addEventListener("event", bumpEvent);
      es.addEventListener("telemetry", (ev: MessageEvent) => {
        sseOk.current = true;
        try {
          const row = JSON.parse(ev.data) as TelemetryRow;
          if (!row?.id) return;
          setSnap((prev) => ({ ...prev, telemetry: mergeById(prev.telemetry, [row], 80) }));
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("run", (ev: MessageEvent) => {
        sseOk.current = true;
        try {
          const row = JSON.parse(ev.data) as InferenceRun;
          if (!row?.id) return;
          setSnap((prev) => ({ ...prev, runs: mergeById(prev.runs, [row], 12) }));
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("hello", () => {
        sseOk.current = true;
        setLink("live");
      });
      es.onerror = () => {
        sseOk.current = false;
      };
    } catch {
      es = null;
    }
    const poll = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh();
    }, 4000);
    void refresh();
    return () => {
      es?.close();
      window.clearInterval(poll);
    };
  }, [refresh]);

  return { snap, setSnap, link, freshIds, now, refresh };
}
