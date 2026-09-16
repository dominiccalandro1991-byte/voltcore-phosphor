import assert from "node:assert/strict";
import test from "node:test";
import { analyzePulse, fuseRails, jaccard, tokenize } from "./dual-rail.ts";

test("jaccard is 1 for identical token sets", () => {
  const a = tokenize("radar feed timeout on edge");
  assert.equal(jaccard(a, a), 1);
});

test("pulse analyzer flags SEV-1 as critical", () => {
  const brief = analyzePulse({ pulseName: "SEV-1 edge outage", pulseId: 1, boardId: 2 });
  assert.equal(brief.severity, "critical");
  assert.equal(brief.axis, "availability");
});

test("fuseRails picks a winner and stays in [0,1]", () => {
  const report = fuseRails([
    { model: "a", rail: "neural", status: "fulfilled", latency_ms: 200, text: "Radar timeout. Restart NWS sync." },
    { model: "b", rail: "symbolic", status: "fulfilled", latency_ms: 4, text: "Pulse radar timeout risk 74 on failure axis." },
  ]);
  assert.ok(report.winnerModel);
  assert.ok(report.score >= 0 && report.score <= 1);
});
