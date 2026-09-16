import type { InferenceResult, MondayEvent } from "./types";
import { analyzePulse, buildMondayPrompt } from "./dual-rail";

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 12_000;
const MAX_TOKENS = 280;

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

export function inferenceCapabilities() {
  return {
    neural: Boolean(env("XAI_API_KEY")),
    openrouter: Boolean(env("OPENROUTER_API_KEY")),
    supabase: Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")),
    mesh: Boolean(env("MESH_HMAC")),
    trunk: env("AUTONOMOUS_TRUNK") === "1",
  };
}

async function chatComplete(opts: {
  url: string;
  key: string;
  model: string;
  prompt: string;
  extraHeaders?: Record<string, string>;
}): Promise<{ text: string; tokens: number }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.key}`,
        ...opts.extraHeaders,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: "Be precise. No markdown fences. Operational tone." },
          { role: "user", content: opts.prompt },
        ],
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${opts.model} HTTP ${res.status} ${detail.slice(0, 180)}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content?.trim() || "";
    if (!text) throw new Error(`${opts.model} empty completion`);
    return { text, tokens: body.usage?.completion_tokens || 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function timedRail(
  model: string,
  rail: InferenceResult["rail"],
  work: () => Promise<{ text: string; tokens: number }>,
): Promise<InferenceResult> {
  const t0 = Date.now();
  try {
    const { text, tokens } = await work();
    return { model, rail, status: "fulfilled", latency_ms: Date.now() - t0, text, tokens };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { model, rail, status: "rejected", latency_ms: Date.now() - t0, reason };
  }
}

/**
 * Concurrent Dual-Rail dispatch. Promise.allSettled so one timeout
 * never cancels the peer. Bound by max(latency_i), O(N) rails.
 */
export async function dispatchDualRail(
  prompt: string,
  event?: MondayEvent,
): Promise<InferenceResult[]> {
  const jobs: Array<Promise<InferenceResult>> = [];
  const xaiKey = env("XAI_API_KEY");
  const orKey = env("OPENROUTER_API_KEY");
  const primary = env("OPENROUTER_PRIMARY_MODEL") || "anthropic/claude-3.5-sonnet";
  const secondary = env("OPENROUTER_SECONDARY_MODEL") || "openai/gpt-4o";
  const appUrl = env("APP_URL") || "https://voltcore-org.github.io/voltcore-command-center/";
  const appName = env("APP_NAME") || "VoltCore";

  if (xaiKey) {
    jobs.push(
      timedRail("xai/grok-4.5", "neural", () =>
        chatComplete({ url: XAI_URL, key: xaiKey, model: "grok-4.5", prompt }),
      ),
    );
  } else if (orKey) {
    jobs.push(
      timedRail(primary, "neural", () =>
        chatComplete({
          url: OPENROUTER_URL,
          key: orKey,
          model: primary,
          prompt,
          extraHeaders: { "HTTP-Referer": appUrl, "X-Title": appName },
        }),
      ),
    );
  }

  if (orKey && xaiKey) {
    jobs.push(
      timedRail(secondary, "secondary", () =>
        chatComplete({
          url: OPENROUTER_URL,
          key: orKey,
          model: secondary,
          prompt,
          extraHeaders: { "HTTP-Referer": appUrl, "X-Title": appName },
        }),
      ),
    );
  }

  jobs.push(
    timedRail("voltcore/pulse-analyzer", "symbolic", async () => {
      const brief = analyzePulse(event, prompt);
      return { text: `${brief.brief}. Recommended: treat as ${brief.severity}.`, tokens: 0 };
    }),
  );

  const settled = await Promise.allSettled(jobs);
  return settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      model: `rail-${i}`,
      rail: "neural" as const,
      status: "rejected" as const,
      latency_ms: 0,
      reason: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });
}

export function mondayPrompt(event: MondayEvent): string {
  return buildMondayPrompt(event, analyzePulse(event));
}
