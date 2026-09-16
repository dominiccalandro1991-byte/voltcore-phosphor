import { createFileRoute } from "@tanstack/react-router";
import { json, options } from "@/lib/voltcore/cors";
import { listenerCount } from "@/lib/voltcore/bus";
import { fleetStatus } from "@/lib/voltcore/pipeline.server";

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      GET: async () => {
        const fleet = await fleetStatus();
        return json({
          ok: true,
          service: "voltcore-core-api",
          time: new Date().toISOString(),
          sse: listenerCount(),
          ...fleet,
        });
      },
    },
  },
});
