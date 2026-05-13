/**
 * Eval report generator — reads the JSONL output from `runner.ts` +
 * `judge.ts` and emits a Markdown summary suitable for pasting into
 * a PR or commit message.
 *
 * Scoring rules (mirrored from `types.ts`):
 *
 *  - toolMatch     — set of tool names called == expected; ordered
 *                    when `exact:true`, set-equality otherwise.
 *  - toolArgsMatch — each `expected.toolArgs[name]` predicate passes
 *                    against the n-th call of that tool.
 *  - replyMatch    — at least one `replyMatches` regex hits, AND no
 *                    `replyMustNot` regex hits.
 *  - bubbleCount   — exact match if specified, otherwise n/a.
 *  - judge         — pulled in from `judge.jsonl` if present.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/eval/report.ts \
 *     --baseline eval/results/run-1/baseline.jsonl \
 *     --candidate eval/results/run-1/candidate.jsonl \
 *     --judge    eval/results/run-1/judge.jsonl \
 *     --out      eval/results/run-1/report.md
 */

import { readFile, writeFile } from "node:fs/promises";

import { ALL_CASES } from "./cases";
import type { CaseRun, CaseScore, TestCase } from "./types";
import type { Judgment } from "./judge";

// ── CLI ────────────────────────────────────────────────────────────────

type Args = {
  baseline?: string;
  candidate: string;
  judge?: string;
  out: string;
};

function parseArgs(argv: string[]): Args {
  const m: Record<string, string | undefined> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        m[key] = next;
        i++;
      } else {
        m[key] = "true";
      }
    }
  }
  if (!m.candidate) throw new Error("--candidate is required");
  if (!m.out) throw new Error("--out is required");
  return {
    baseline: m.baseline,
    candidate: m.candidate,
    judge: m.judge,
    out: m.out,
  };
}

async function readJsonl<T>(p: string): Promise<T[]> {
  const raw = await readFile(p, "utf8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

// ── Scoring ────────────────────────────────────────────────────────────

function score(c: TestCase, run: CaseRun, judge?: Judgment): CaseScore {
  const notes: string[] = [];

  // Tool match
  const called = run.toolCalls.map((t) => t.name);
  const expected = c.expected.toolsCalled;
  let toolMatch: "pass" | "fail";
  if (c.expected.exact) {
    toolMatch =
      called.length === expected.length &&
      expected.every((e, i) => called[i] === e)
        ? "pass"
        : "fail";
  } else {
    // Subset / order-tolerant: every expected tool appears at least
    // once, AND if `mustNotSave` is set, save_memory must not appear.
    const calledSet = new Set(called);
    let ok = expected.every((e) => calledSet.has(e));
    if (c.expected.mustNotSave && calledSet.has("save_memory")) {
      ok = false;
      notes.push("agent saved when it should have asked");
    }
    toolMatch = ok ? "pass" : "fail";
    if (!ok && expected.length > 0) {
      notes.push(`expected ${expected.join(",")} got ${called.join(",") || "(none)"}`);
    }
  }

  // Tool arg predicates
  let toolArgsMatch: "pass" | "fail" | "n/a" = "n/a";
  if (c.expected.toolArgs) {
    let argsOk = true;
    for (const [name, preds] of Object.entries(c.expected.toolArgs)) {
      const callsOfName = run.toolCalls.filter((t) => t.name === name);
      for (let i = 0; i < preds.length; i++) {
        const call = callsOfName[i];
        if (!call) {
          argsOk = false;
          notes.push(`missing call ${name}#${i + 1}`);
          break;
        }
        if (!preds[i](call.args)) {
          argsOk = false;
          notes.push(`${name}#${i + 1} args predicate failed`);
        }
      }
    }
    toolArgsMatch = argsOk ? "pass" : "fail";
  }

  // Reply match
  let replyMatch: "pass" | "fail" | "n/a" = "n/a";
  if (c.expected.replyMatches || c.expected.replyMustNot) {
    let ok = true;
    if (c.expected.replyMatches) {
      const hit = c.expected.replyMatches.some((r) => r.test(run.text));
      if (!hit) {
        ok = false;
        notes.push(`reply matched none of: ${c.expected.replyMatches.map(String).join(", ")}`);
      }
    }
    if (c.expected.replyMustNot) {
      const bad = c.expected.replyMustNot.find((r) => r.test(run.text));
      if (bad) {
        ok = false;
        notes.push(`reply matched forbidden: ${String(bad)}`);
      }
    }
    replyMatch = ok ? "pass" : "fail";
  }

  // Bubble count
  let bubbleCountMatch: "pass" | "fail" | "n/a" = "n/a";
  if (typeof c.expected.bubbleCount === "number") {
    bubbleCountMatch =
      run.bubbles.length === c.expected.bubbleCount ? "pass" : "fail";
    if (bubbleCountMatch === "fail") {
      notes.push(
        `bubbles=${run.bubbles.length} expected=${c.expected.bubbleCount}`,
      );
    }
  }

  return {
    caseId: c.id,
    category: c.category,
    description: c.description,
    toolMatch,
    toolArgsMatch,
    replyMatch,
    bubbleCountMatch,
    judge: judge
      ? { equivalent: judge.equivalent, reason: judge.reason }
      : undefined,
    notes,
  };
}

// ── Markdown render ────────────────────────────────────────────────────

function emoji(s: "pass" | "fail" | "n/a"): string {
  return s === "pass" ? "✅" : s === "fail" ? "❌" : "—";
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return ((n / total) * 100).toFixed(1) + "%";
}

function p50(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function renderReport(
  baselineRuns: CaseRun[] | null,
  candidateRuns: CaseRun[],
  judgments: Judgment[],
): string {
  const candidateById = new Map(candidateRuns.map((r) => [r.caseId, r]));
  const baselineById = baselineRuns
    ? new Map(baselineRuns.map((r) => [r.caseId, r]))
    : null;
  const judgeById = new Map(judgments.map((j) => [j.caseId, j]));

  const scores: CaseScore[] = [];
  for (const c of ALL_CASES) {
    const run = candidateById.get(c.id);
    if (!run) continue;
    const judge = judgeById.get(c.id);
    const s = score(c, run, judge);

    if (baselineById) {
      const b = baselineById.get(c.id);
      if (b) {
        s.costDeltaPct =
          b.meta.costUsd > 0
            ? ((run.meta.costUsd - b.meta.costUsd) / b.meta.costUsd) * 100
            : 0;
        s.latencyDeltaPct =
          b.meta.latencyMs > 0
            ? ((run.meta.latencyMs - b.meta.latencyMs) / b.meta.latencyMs) * 100
            : 0;
      }
    }
    scores.push(s);
  }

  const toolPass = scores.filter((s) => s.toolMatch === "pass").length;
  const argPass = scores.filter((s) => s.toolArgsMatch !== "fail").length;
  const replyPass = scores.filter((s) => s.replyMatch !== "fail").length;
  const judgeYes = scores.filter((s) => s.judge?.equivalent === "yes").length;
  const judgePartial = scores.filter(
    (s) => s.judge?.equivalent === "partial",
  ).length;
  const judgeNo = scores.filter((s) => s.judge?.equivalent === "no").length;

  const baselineCost = baselineRuns
    ? baselineRuns.reduce((s, r) => s + r.meta.costUsd, 0)
    : 0;
  const candidateCost = candidateRuns.reduce(
    (s, r) => s + r.meta.costUsd,
    0,
  );
  const baselineP50 = baselineRuns ? p50(baselineRuns.map((r) => r.meta.latencyMs)) : 0;
  const candidateP50 = p50(candidateRuns.map((r) => r.meta.latencyMs));

  const candidateModel = candidateRuns[0]?.model ?? "(unknown)";
  const baselineModel = baselineRuns?.[0]?.model ?? null;

  const lines: string[] = [];
  lines.push(`# Eval Report`);
  lines.push("");
  lines.push(`- **Cases**: ${scores.length}`);
  lines.push(`- **Candidate**: \`${candidateModel}\``);
  if (baselineModel) lines.push(`- **Baseline**:  \`${baselineModel}\``);
  lines.push(`- **Judge**:     ${judgments.length > 0 ? `\`${"(see judge.jsonl)"}\`` : "(none)"}`);
  lines.push("");

  lines.push(`## Headline`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Tool match | ${toolPass}/${scores.length} (${pct(toolPass, scores.length)}) |`);
  lines.push(`| Tool-args match (where asserted) | ${argPass}/${scores.length} |`);
  lines.push(`| Reply pattern match | ${replyPass}/${scores.length} |`);
  if (judgments.length > 0) {
    lines.push(
      `| Judge equivalent (yes+partial) | ${judgeYes + judgePartial}/${judgments.length} (${pct(judgeYes + judgePartial, judgments.length)}) |`,
    );
    lines.push(`| Judge yes / partial / no | ${judgeYes} / ${judgePartial} / ${judgeNo} |`);
  }
  if (baselineRuns) {
    const delta = baselineCost > 0
      ? (((candidateCost - baselineCost) / baselineCost) * 100).toFixed(1)
      : "n/a";
    lines.push(
      `| Cost (baseline → candidate) | $${baselineCost.toFixed(4)} → $${candidateCost.toFixed(4)} (Δ ${delta}%) |`,
    );
    const latDelta = baselineP50 > 0
      ? (((candidateP50 - baselineP50) / baselineP50) * 100).toFixed(1)
      : "n/a";
    lines.push(
      `| Latency p50 | ${baselineP50}ms → ${candidateP50}ms (Δ ${latDelta}%) |`,
    );
  } else {
    lines.push(`| Cost (candidate only) | $${candidateCost.toFixed(4)} |`);
    lines.push(`| Latency p50 | ${candidateP50}ms |`);
  }
  lines.push("");

  lines.push(`## Per-case`);
  lines.push("");
  lines.push(`| # | Case | Cat | Tool | Args | Reply | Judge | Cost Δ | Notes |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|`);
  scores.forEach((s, i) => {
    const judgeCell =
      s.judge?.equivalent === "yes" ? "✅" :
      s.judge?.equivalent === "partial" ? "🟡" :
      s.judge?.equivalent === "no" ? "❌" : "—";
    const costCell =
      typeof s.costDeltaPct === "number"
        ? `${s.costDeltaPct >= 0 ? "+" : ""}${s.costDeltaPct.toFixed(0)}%`
        : "—";
    const note = s.notes.length > 0 ? s.notes.join("; ").slice(0, 80) : "";
    lines.push(
      `| ${i + 1} | ${s.caseId} | ${s.category} | ${emoji(s.toolMatch)} | ${emoji(s.toolArgsMatch)} | ${emoji(s.replyMatch)} | ${judgeCell} | ${costCell} | ${note} |`,
    );
  });
  lines.push("");

  // Failures detail
  const fails = scores.filter(
    (s) =>
      s.toolMatch === "fail" ||
      s.toolArgsMatch === "fail" ||
      s.replyMatch === "fail" ||
      s.judge?.equivalent === "no",
  );
  if (fails.length > 0) {
    lines.push(`## Failures (${fails.length})`);
    lines.push("");
    for (const f of fails) {
      lines.push(`### \`${f.caseId}\` — ${f.description}`);
      lines.push("");
      for (const n of f.notes) lines.push(`- ${n}`);
      if (f.judge && f.judge.equivalent === "no") {
        lines.push(`- judge: ${f.judge.reason}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const candidate = await readJsonl<CaseRun>(args.candidate);
  const baseline = args.baseline ? await readJsonl<CaseRun>(args.baseline) : null;
  const judgments = args.judge ? await readJsonl<Judgment>(args.judge) : [];
  const md = renderReport(baseline, candidate, judgments);
  await writeFile(args.out, md, "utf8");
  console.log(`📝 ${args.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
