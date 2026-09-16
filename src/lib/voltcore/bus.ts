export type BusMessage = {
  type: "telemetry" | "event" | "run" | "heartbeat" | "hello";
  payload: unknown;
  ts: number;
};

type Listener = (msg: BusMessage) => void;

const g = globalThis as typeof globalThis & {
  __voltBus__?: { listeners: Set<Listener> };
};

function hub() {
  if (!g.__voltBus__) g.__voltBus__ = { listeners: new Set() };
  return g.__voltBus__;
}

/** Fan-out to SSE subscribers. O(L) listeners. */
export function publish(type: BusMessage["type"], payload: unknown): void {
  const msg: BusMessage = { type, payload, ts: Date.now() };
  for (const fn of hub().listeners) {
    try {
      fn(msg);
    } catch {
      /* a dead socket must not poison the bus */
    }
  }
}

export function subscribe(fn: Listener): () => void {
  hub().listeners.add(fn);
  return () => {
    hub().listeners.delete(fn);
  };
}

export function listenerCount(): number {
  return hub().listeners.size;
}
