import { createFileRoute } from "@tanstack/react-router";
import { json, options } from "@/lib/voltcore/cors";
import { fleetStatus } from "@/lib/voltcore/pipeline.server";

export const Route = createFileRoute("/api/v1/fleet")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      GET: async () => json(await fleetStatus()),
    },
  },
});
