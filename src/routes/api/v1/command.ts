import { createFileRoute } from "@tanstack/react-router";
import { json, options } from "@/lib/voltcore/cors";
import { runCommand } from "@/lib/voltcore/pipeline.server";

export const Route = createFileRoute("/api/v1/command")({
  server: {
    handlers: {
      OPTIONS: async () => options(),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { action?: string; source?: string };
        try {
          const result = await runCommand(String(body.action || ""), String(body.source || ""));
          return json(result);
        } catch (err) {
          const e = err as { status?: number; code?: string; message?: string };
          return json({ error: e.code || "error", detail: e.message }, e.status || 500);
        }
      },
    },
  },
});
