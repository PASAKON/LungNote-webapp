/**
 * LLM judge — uses a stronger model to decide whether the candidate's
 * Thai reply is equivalent to the baseline's for a given user turn.
 *
 * Why an LLM and not a regex: many cases have multiple valid phrasings.
 * Regex catches "did the agent mention the right keywords"; the judge
 * catches "did it convey the same intent + tone in natural Thai".
 *
 * Default judge model: Sonnet 4.6 (or whichever is stronger than both
 * candidates being compared). The judge runs ~1 call per case so it's
 * the same cost order as one extra eval sweep.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/eval/judge.ts \
 *     --baseline eval/results/run-1/baseline.jsonl \
 *     --candidate eval/results/run-1/candidate.jsonl \
 *     --judge anthropic/claude-sonnet-4-5 \
 *     --out eval/results/run-1/judge.jsonl
 */

import { generateText } from "ai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ALL_CASES } from "./cases";
import { resolveEvalModel } from "./model-factory";
import type { CaseRun, TestCase } from "./types";

export type Judgment = {
  caseId: string;
  equivalent: "yes" | "partial" | "no";
  reason: string;
  thaiQualityCandidateVsBaseline: "better" | "same" | "slightly_worse" | "much_worse";
  toneMatch: boolean;
  missingInfoInCandidate: string[];
};

// ── CLI ────────────────────────────────────────────────────────────────

type Args = {
  baselinePath: string;
  candidatePath: string;
  judgeModel: string;
  outPath: string;
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
  for (const k of ["baseline", "candidate", "out"]) {
    if (!m[k]) throw new Error(`--${k} is required`);
  }
  return {
    baselinePath: m.baseline!,
    candidatePath: m.candidate!,
    judgeModel: m.judge ?? "anthropic/claude-sonnet-4-5",
    outPath: m.out!,
  };
}

// ── JSONL ──────────────────────────────────────────────────────────────

async function readJsonl<T>(p: string): Promise<T[]> {
  const raw = await readFile(p, "utf8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

// ── Judge prompt ───────────────────────────────────────────────────────

function buildPrompt(c: TestCase, a: CaseRun, b: CaseRun): string {
  const aText = a.text || "(no reply)";
  const bText = b.text || "(no reply)";
  return `You are an impartial evaluator for a Thai task-management LINE chatbot.

Compare two assistant replies to the same user turn and decide whether they are equivalent for a Thai-speaking student user.

Equivalence rule:
- "yes"     — both replies satisfy the user's intent equally well; tone + content + completeness all comparable. Minor wording differences OK.
- "partial" — both address the intent but one is noticeably weaker in completeness, tone, or politeness. Or one missed a detail the other got.
- "no"      — one of them fails the intent (wrong tool result, refused when it shouldn't have, off-topic, English when Thai expected, etc.).

Also rate Thai language quality of the CANDIDATE relative to the BASELINE:
- "better" / "same" / "slightly_worse" / "much_worse".

User said: """${c.userText}"""

Reply A (baseline, ${a.model}):
"""${aText}"""

Reply B (candidate, ${b.model}):
"""${bText}"""

Tools A invoked: ${a.toolCalls.map((t) => t.name).join(", ") || "(none)"}
Tools B invoked: ${b.toolCalls.map((t) => t.name).join(", ") || "(none)"}

Respond with ONLY this JSON shape, no prose around it:
{
  "equivalent": "yes" | "partial" | "no",
  "reason": "<one short sentence>",
  "thaiQualityCandidateVsBaseline": "better" | "same" | "slightly_worse" | "much_worse",
  "toneMatch": true | false,
  "missingInfoInCandidate": [<short strings, max 3>]
}`;
}

function parseJudgeJson(s: string): Judgment | null {
  // The judge often wraps in ```json ... ``` — strip.
  const cleaned = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const o = JSON.parse(cleaned) as Partial<Judgment>;
    if (!o.equivalent || !o.reason) return null;
    return {
      caseId: "", // filled in by caller
      equivalent: o.equivalent,
      reason: String(o.reason),
      thaiQualityCandidateVsBaseline:
        o.thaiQualityCandidateVsBaseline ?? "same",
      toneMatch: o.toneMatch !== false,
      missingInfoInCandidate: Array.isArray(o.missingInfoInCandidate)
        ? o.missingInfoInCandidate.map(String).slice(0, 3)
        : [],
    };
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const [baseline, candidate] = await Promise.all([
    readJsonl<CaseRun>(args.baselinePath),
    readJsonl<CaseRun>(args.candidatePath),
  ]);

  const baselineById = new Map(baseline.map((r) => [r.caseId, r]));
  const candidateById = new Map(candidate.map((r) => [r.caseId, r]));
  const casesById = new Map(ALL_CASES.map((c) => [c.id, c]));

  const judge = resolveEvalModel(args.judgeModel);

  const judgments: Judgment[] = [];
  let i = 0;
  for (const c of ALL_CASES) {
    i++;
    const a = baselineById.get(c.id);
    const b = candidateById.get(c.id);
    if (!a || !b) continue;
    const prompt = buildPrompt(c, a, b);
    const res = await generateText({
      model: judge.model,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 256,
    });
    const parsed = parseJudgeJson(res.text);
    const j: Judgment = parsed
      ? { ...parsed, caseId: c.id }
      : {
          caseId: c.id,
          equivalent: "no",
          reason: "judge_parse_failed",
          thaiQualityCandidateVsBaseline: "same",
          toneMatch: false,
          missingInfoInCandidate: [],
        };
    judgments.push(j);
    console.log(
      `${i}/${ALL_CASES.length} ${c.id.padEnd(34)} ${j.equivalent.padEnd(7)} ${j.thaiQualityCandidateVsBaseline.padEnd(15)} — ${j.reason.slice(0, 80)}`,
    );
  }

  await mkdir(path.dirname(args.outPath), { recursive: true });
  await writeFile(
    args.outPath,
    judgments.map((j) => JSON.stringify(j)).join("\n") + "\n",
    "utf8",
  );

  const yes = judgments.filter((j) => j.equivalent === "yes").length;
  const partial = judgments.filter((j) => j.equivalent === "partial").length;
  const no = judgments.filter((j) => j.equivalent === "no").length;
  console.log(
    `\n✅ judge done. yes=${yes} partial=${partial} no=${no} (n=${judgments.length})`,
  );
  // unused — keep for future per-category reports
  void casesById;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
