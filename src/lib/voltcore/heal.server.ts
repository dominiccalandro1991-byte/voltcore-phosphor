import { ANOMALY, FLEET, FORBID, MAX_PATCH } from "./fleet";
import { inferenceCapabilities } from "./inference.server";
import { insertEvent } from "./telemetry.server";
import type { VoltEvent } from "./types";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function boundPath(source: string, filePath: string): boolean {
  const spec = FLEET[source];
  if (!spec) return false;
  const p = String(filePath || "").replace(/^\/+/, "");
  if (!p || p.includes("..") || FORBID.test(p)) return false;
  return spec.paths.some((allow) => (allow.endsWith("/") ? p.startsWith(allow) : p === allow));
}

async function generatePatch(event: VoltEvent): Promise<{
  model: string;
  summary: string;
  files: Array<{ path: string; content: string }>;
  raw: string;
}> {
  const xai = env("XAI_API_KEY");
  const orKey = env("OPENROUTER_API_KEY");
  const model = xai
    ? "grok-4.5"
    : env("OPENROUTER_PRIMARY_MODEL") || "openai/gpt-oss-20b:free";
  const url = xai ? "https://api.x.ai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const key = xai || orKey;
  if (!key) {
    return {
      model: "offline",
      summary: "Neural rail offline — no XAI_API_KEY or OPENROUTER_API_KEY.",
      files: [],
      raw: "",
    };
  }
  const prompt = [
    "You are VOLTCORE ProofPatch. Emit a structural patch as JSON only:",
    '{"summary":"...","files":[{"path":"relative/path","content":"full new file contents"}]}',
    "Rules: one or two files max; no secrets; no .env; keep public API; smallest change.",
    "Event: " +
      JSON.stringify({
        id: event.id,
        source: event.source,
        event_type: event.event_type,
        severity: event.severity,
        payload: event.payload,
      }).slice(0, 6000),
  ].join("\n");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(xai
        ? {}
        : {
            "HTTP-Referer": env("APP_URL") || "https://voltcore-org.github.io/voltcore-command-center/",
            "X-Title": "VOLTCORE Mesh",
          }),
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        { role: "system", content: "Return only JSON. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw Object.assign(new Error(detail.slice(0, 400)), { status: 502, code: "inference_error" });
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content || "";
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  let parsed: { summary?: string; files?: Array<{ path: string; content: string }> } = {
    summary: raw.slice(0, 800),
    files: [],
  };
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as typeof parsed;
    } catch {
      /* keep fallback */
    }
  }
  return {
    model,
    summary: String(parsed.summary || "").slice(0, 2000),
    files: Array.isArray(parsed.files) ? parsed.files : [],
    raw,
  };
}

export async function remediate(event: VoltEvent, autonomous = false) {
  const gen = await generatePatch(event);
  const files = (gen.files || []).filter((f) => f && f.path && typeof f.content === "string");
  const reasons: string[] = [];
  if (!ANOMALY.has(String(event.severity || "").toLowerCase())) reasons.push("severity_not_anomaly");
  if (!FLEET[event.source]) reasons.push("source_not_in_fleet");
  if (!files.length) reasons.push("no_files");
  for (const f of files) {
    if (!boundPath(event.source, f.path)) reasons.push("path_out_of_bounds:" + f.path);
    if (f.content.length > MAX_PATCH) reasons.push("patch_too_large:" + f.path);
    if (FORBID.test(f.path) || /sk-|ghp_|BEGIN PRIVATE|service_role/i.test(f.content)) {
      reasons.push("secret_pattern:" + f.path);
    }
  }
  const att = { bound: reasons.length === 0, reasons };
  const patch = files.length
    ? files.map((f) => "### FILE: " + f.path + "\n" + f.content).join("\n\n")
    : gen.raw;
  const result = {
    model: gen.model,
    summary: gen.summary || "Patch generated",
    patch,
    attestation: att,
    committed: false,
    sha: null as string | null,
    autonomous,
    capabilities: inferenceCapabilities(),
  };
  if (!autonomous) return result;
  if (!att.bound) {
    result.summary = "Attestation rejected: " + att.reasons.join(", ");
    return result;
  }
  result.summary = "Attestation passed. AUTONOMOUS_TRUNK commits are not executed from this surface.";
  await insertEvent({
    source: "command_center.remediate",
    event_type: "system.recovery",
    severity: "info",
    payload: { status: "patched", incident: event.id, source: event.source, files: files.map((f) => f.path) },
  });
  return result;
}
