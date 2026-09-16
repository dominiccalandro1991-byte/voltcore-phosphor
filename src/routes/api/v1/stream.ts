import { createFileRoute } from "@tanstack/react-router";
import { CORS, options } from "@/lib/voltcore/cors";
import { subscribe } from "@/lib/voltcore/bus";

export const Route = createFileRoute("/api/v1/stream")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      GET: async ({ request }) => {
        const encoder = new TextEncoder();
        let unsub = () => {};
        let beat: ReturnType<typeof setInterval> | undefined;
        const stream = new ReadableStream({
          start(controller) {
            const send = (event: string, data: unknown) => {
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                );
              } catch {
                cleanup();
              }
            };
            const cleanup = () => {
              unsub();
              if (beat) clearInterval(beat);
            };
            unsub = subscribe((msg) => send(msg.type, msg.payload));
            send("hello", { ts: Date.now() });
            beat = setInterval(() => send("heartbeat", { ts: Date.now() }), 15000);
            request.signal.addEventListener("abort", () => {
              cleanup();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            });
          },
          cancel() {
            unsub();
            if (beat) clearInterval(beat);
          },
        });
        return new Response(stream, {
          headers: {
            ...CORS,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
