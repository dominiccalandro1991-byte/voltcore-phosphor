# VOLTCORE PHOSPHOR — deterministic session handoff

**Snapshot time:** 2026-09-16T10:14:00Z (05:14 CDT)  
**Purpose:** Strict state for a **new session**. Do not rediscover this from chat. Execute the next directives against this file.  
**Policy:** `AUTONOMOUS_TRUNK=0`. Do not rewrite Dual-Rail `core-api`. Do not put secrets on Vercel. Do not re-enable per-repo GitHub Actions minute crons.

---

## 1.0 Topology (locked)

```
[ Browser / Phosphor lattice ]
        |  GET /api/v1/health
        |  GET /api/v1/events?limit=150
        |  POST /api/v1/events   { source, type, severity, payload }
        |  POST /api/v1/remediate { event }     (no HMAC)
        v
[ Cloudflare Worker  core-api ]
  origin: https://core-api.dominic-calandro1991.workers.dev
  repo:   dominiccalandro1991-byte/core-api   (retain)
  runtime: wrangler.toml  main = src/index.js
        |
        |  PostgREST + Dual-Rail OpenRouter
        v
[ Supabase ]  events.tenant_id UUID NOT NULL
              resolved tenant_id = e1ab0f92-eef7-4370-a690-b1b656016fd3
```

| Plane | Host | Repo | Secrets |
|---|---|---|---|
| **UI** | Vercel production `https://voltcore-phosphor.vercel.app` | `dominiccalandro1991-byte/voltcore-phosphor` | **NONE.** Do not set `MESH_HMAC`, `SUPABASE_*`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, `GITHUB_TOKEN`, `MONDAY_SIGNING_SECRET`, `DATABASE_URL`. |
| **Trunk** | Cloudflare Worker | `dominiccalandro1991-byte/core-api` | All Dual-Rail keys live **only** here (dashboard bindings). |
| **Static HUDs** | GitHub Pages | `voltcore-org/storm-path`, `voltcore-org/voltcore-command-center`, etc. | None. |
| **Deprecated org clone** | n/a | `voltcore-org/core-api` **does not exist** | — |

1.1 Vercel project: `voltcore-phosphor` / `prj_BfG529w0aYJDsadiZ7HK5PUU22Nk` / team `team_TPGRqQiELuY2v9MPtt4Cqt8t`. SSO protection **off**. Framework: TanStack Start.  
1.2 Phosphor talks to the Worker with CORS `*`. HMAC (`X-Voltcore-Mesh` / timestamp / nonce / signature) is **only** for `/api/v1/command` and `/api/v1/heal`. UI must not call those.  
1.3 Local Phosphor server functions (`getSnapshot`, `fireMonday`, `pingFleet`) are trunk-first and fail closed if Vercel has no DB. Dual-Rail inference on Vercel is unused.  
1.4 Do **not** deploy Phosphor to GitHub Pages (needs SSE/server functions). Do **not** host the UI on the Worker.

---

## 2.0 Inventory mutation (executed in this snapshot)

### 2.1 Deprecated — purge, do not build, do not heartbeat

| Lane | Repo | Action |
|---|---|---|
| `asml-nexus` | `dominiccalandro1991-byte/asml-nexus` | **Deprecated.** Removed from `src/lib/voltcore/fleet.ts` (`FLEET` + `FLEET_GROUPS.kinetic`) and `src/lib/voltcore/mesh-beat.ts` `INCOMPLETE`. |
| `VOLTCORE-IdeaForge` | `dominiccalandro1991-byte/VOLTCORE-IdeaForge` | **Deprecated.** Removed from `FLEET` + `FLEET_GROUPS.studio` + `INCOMPLETE`. |

Next session must **not** re-add these lanes. GitHub repos may remain; they are out of the lattice.

### 2.2 Construction targets — retain

| Lane | Repo | Current fact | Required completion |
|---|---|---|---|
| `causalrail` | `voltcore-org/causalrail` | Incomplete: no runtime manifest at root sufficient for a 60s emitter. Keep in kinetic/ops lattice. | Full structural completion: `package.json` (or `index.html`), src, `voltcore/heartbeat.mjs` posting `source=causalrail` `type=health.heartbeat` every 60s **from a Cloudflare Cron or in-app timer — not GHA minute cron**. |
| `paleochron-arrowforge` | `voltcore-org/paleochron-arrowforge` | **Empty repo** (`size: 0`). Keep in `FLEET_GROUPS.kinetic`. | Seed the lithic/PWA app on `main`, then same 60s telemetry contract. |

Diagnostic payload (until they go live):

```json
{
  "source": "<lane>",
  "type": "health.diagnostic",
  "severity": "warn",
  "payload": {
    "status": "incomplete",
    "surface": "cron|phosphor",
    "interval_s": 60,
    "incomplete": true,
    "missing_dependencies": [],
    "required_build_specs": []
  }
}
```

---

## 3.0 Telemetry daemon (next session — required)

### 3.1 Problem
Client-side `setInterval(60000)` in Phosphor (`src/lib/voltcore/mesh-beat.ts` + `use-live.ts`) only runs while the Vercel tab is open. Per-repo GitHub Actions `cron: '* * * * *'` **flooded the operator's phone** with failure notifications and is **DISABLED** on 17 personal repos. Do not re-enable it.

### 3.2 Required implementation (core-api, additive, not a Dual-Rail rewrite)

Add a **Cloudflare Cron Trigger** on `dominiccalandro1991-byte/core-api`:

```toml
# wrangler.toml
[triggers]
crons = ["* * * * *"]
```

```js
// src/index.js — add scheduled export; keep existing fetch()
export default {
  async fetch(request, env, ctx) { /* unchanged Dual-Rail router */ },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollFleet(env));
  },
};
```

`pollFleet` (new module, e.g. `src/cron.js`):

1. For each MECE lane in Worker `FLEET` (and Phosphor `fleet.ts` keys), **except** deprecated `asml-nexus` / `VOLTCORE-IdeaForge`.
2. `POST` equivalent of ingest: `source=<lane>`, `type=health.heartbeat` or `health.diagnostic` if construction-target incomplete.
3. Must set `tenant_id` via existing `resolveTenantId` (UUID from last events row). **Do not** hardcode `"voltcore"` (that is `22P02`).
4. Use `type` (Worker maps `body.type || body.event_type`).
5. Big-O: O(L) sequential or small-batch fetches, L ≈ 32. No secrets in payloads.
6. **Do not** call OpenRouter / heal / HMAC paths from cron.

This eliminates client-side execution dependency. After cron is live, Phosphor `beatMissingLanes` may stay as a UX accent but is no longer the source of truth.

### 3.3 Ingest contract (proven 202)

```
POST https://core-api.dominic-calandro1991.workers.dev/api/v1/events
Content-Type: application/json

{"source":"<FLEET key>","type":"health.heartbeat","severity":"info","payload":{"status":"live","interval_s":60}}
```

Proven: HTTP **202** after Worker commit `6ee2851` (`resolveTenantId` from existing `events.tenant_id`).  
Failure mode if tenant omitted: Postgres `23502` on `events.tenant_id`.  
Failure mode if tenant is the string `voltcore`: `22P02` invalid uuid.

---

## 4.0 Phosphor UI (what is running)

| Item | Value |
|---|---|
| Product | VOLTCORE PHOSPHOR — lattice oscilloscope (not a KPI dashboard) |
| Engine | `src/lib/voltcore/phosphor.ts` — `hydratePhosphor` / `selectLane` / `setScope` |
| Lattice | `src/components/command-center/lattice.tsx` — left nav is real `<button>` → `selectLane`; canvas tick → `setScope` |
| App | `src/components/command-center/app.tsx` |
| Live merge | `use-live.ts`: SSE local + 4s poll of trunk `/events` + `/health` |
| Window | 15 min phosphor decay; `STALE_MS` 3 min; LANES counter = present ∪ lastT (not 3-min live-only) |
| Brand | void `#07090c`, cyan `#00E5FF`, IBM Plex |
| Git | `main` on `dominiccalandro1991-byte/voltcore-phosphor` |
| Last known commits | lattice click `cc79258`; mesh-beat `fd6595c`; fleet purge of deprecated lanes in this handoff workspace |

Lane click: `selectLane(lane)` sets `selectedLaneId` + latest event. `setScope(tickId, lane)` sets both.

---

## 5.0 core-api (do not rewrite)

| Item | Value |
|---|---|
| Repo | `dominiccalandro1991-byte/core-api` |
| Entry | `src/index.js` |
| Ingest | `src/events.js` — `ingest`, `listEvents`, `resolveTenantId` |
| Monday | `src/monday.js` — HTTP 200 ack, `waitUntil` Dual-Rail |
| Heal | `src/heal.js` — `/api/v1/remediate` open; `/api/v1/heal` HMAC |
| Deploy | `.github/workflows/deploy.yml` on `main` using repo secret `CLOUDFLARE_API_TOKEN` → `npx wrangler deploy` |
| Health (last known) | `supabase: true`, `openrouter: true`, `mesh: true`, `trunk: false` (`AUTONOMOUS_TRUNK=0`), `neural: false` |
| Worker fleet keys (health.fleet) | `storm-path`, `storm-path-web`, `storm-path-mobile`, `nano-sandbox`, `snca-codec`, `nano-cloud`, `voltcore-command-center`, `trueturn`, `grok-orchestration-engine`, `monday` — **subset**; Phosphor `fleet.ts` is the full lattice |

Last Worker commits this arc: `4da65a5` tenant_id field; `6ee2851` UUID resolver. Deploy runs succeeded.

---

## 6.0 MECE fleet after purge

Phosphor `FLEET` / `FLEET_GROUPS` (plus `_unmapped` catch-all):

| Group | Lanes |
|---|---|
| trunk | `core-api` |
| storm | `storm-path`, `storm-path-web`, `storm-path-mobile`, `storm-path-app` |
| nano | `nano-sandbox`, `snca-codec`, `nano-cloud` (alias of snca-codec) |
| command | `voltcore-command-center`, `command_center.remediate`, `grok-orchestration-engine`, `monday`, `voltcore-code-agent`, `voltcore-anvil`, `voltcore-phosphor` |
| kinetic | `trueturn`, `aetherion`, `voltcore-asml`, `conways-game-of-life`, `paleochron-arrowforge` |
| ops | `causalrail`, `orbit-life-operator`, `apexline-revenue-dashboard`, `leadmorph-engine`, `kite-zest-acre-fjord` |
| studio | `vc010-five-artists-engine`, `daily-ignition`, `daily-ignition-sober-stack`, `lumenarchive`, `lumen-archive-core`, `lovable-engine-core` |

**GitHub org `voltcore-org`:** storm-path-web, voltcore-asml, Aetherion, storm-path, storm-path-mobile, voltcore-command-center, nano-sandbox, snca-codec, conways-game-of-life, causalrail, paleochron-arrowforge, vc010-five-artists-engine.

**GitHub user `dominiccalandro1991-byte`:** voltcore-phosphor, core-api, voltcore-code-agent, apexline-revenue-dashboard (private), kite-zest-acre-fjord, storm-path-web, storm-path-app, voltcore-anvil, orbit-life-operator, asml-nexus (**deprecated, out of lattice**), TrueTurn, daily-ignition, daily-ignition-sober-stack, lumenarchive (private), lumen-archive-core (private), lovable-engine-core (private), leadmorph-engine (private), VOLTCORE-IdeaForge (**deprecated, out of lattice**).

---

## 7.0 Hard constraints for the next session

7.1 Do not put Dual-Rail secrets on Vercel.  
7.2 Do not enable `voltcore-heartbeat.yml` GitHub Actions (disabled on 17 personal repos after notification flood).  
7.3 Do not `gh workflow run` a mesh of repos.  
7.4 Do not refactor Dual-Rail / OpenRouter / Monday handshake. Cron is additive.  
7.5 Do not reintroduce `asml-nexus` or `VOLTCORE-IdeaForge` into `fleet.ts`.  
7.6 `tenant_id` is UUID, never the string `voltcore`.  
7.7 Operator GitHub mobile notifications: Actions-on-every-run was the lock-screen failure mode.

---

## 8.0 Next-session execution order (MECE)

1. Confirm Phosphor `fleet.ts` on `main` has no `asml-nexus` / `VOLTCORE-IdeaForge`; push if this workspace purge is unpushed.  
2. Implement `scheduled()` cron on `core-api` (section 3.2). Deploy via existing `deploy.yml` only.  
3. Prove: wait 60s, `GET /api/v1/events?limit=20` shows per-lane `health.heartbeat` with `surface` from cron, without a Phosphor tab open.  
4. Complete `voltcore-org/causalrail` structure + 60s emitter.  
5. Seed `voltcore-org/paleochron-arrowforge` + 60s emitter.  
6. Do not touch Vercel env. Do not delete GitHub repos unless the operator explicitly orders delete.

---

## 9.0 Complexity

| Path | Time | Space |
|---|---|---|
| Phosphor ingest | O(E), E ≤ 150 | O(L × 96) ticks |
| Lattice rAF | O(L + E_visible) | canvas buffer |
| Cron pollFleet | O(L) sequential POSTs | O(1) extra |
| `Promise.allSettled` Dual-Rail | O(N) models, latency = slowest | O(N) |

L ≈ 32 after purge (plus `_unmapped`).
