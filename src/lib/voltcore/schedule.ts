/** Decouple ACK from downstream work. Prefer waitUntil on Workers/Vercel. */
export function scheduleBackground(work: () => Promise<void>): void {
  const run = () => {
    void work().catch((err) => {
      console.error("[voltcore] background", err);
    });
  };
  const g = globalThis as typeof globalThis & {
    waitUntil?: (p: Promise<unknown>) => void;
  };
  if (typeof g.waitUntil === "function") {
    g.waitUntil(work().catch((err) => console.error("[voltcore] background", err)));
    return;
  }
  if (typeof setImmediate === "function") {
    setImmediate(run);
    return;
  }
  setTimeout(run, 0);
}
