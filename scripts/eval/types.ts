/**
 * Shared types for the LungNote agent eval harness.
 *
 * The eval runs a fixed corpus of test cases against an "under test"
 * model and (optionally) a "baseline" model, then scores the two
 * against each other along these axes:
 *
 *  - tool_match     — same set of tool names invoked, in the same order
 *  - tool_args      — required args match a per-case regex/predicate
 *  - reply_judge    — LLM judge (a stronger model) rules whether the two
 *                     final replies are equivalent for the Thai user
 *  - bubble_count   — same number of LINE bubbles
 *  - cost / latency — strict numeric diff
 *
 * Each test case lives in code (`cases.ts`) so reviewers can read the
 * expected behavior without spelunking the agent runtime. Real-history
 * cases (PR #2) get appended later via `fetch-real.ts`.
 */

import type { TodoFixture, UserMemoryFixture } from "./mock-tools";

/** Coarse intent label — useful for grouping failures in the report. */
export type CaseCategory =
  | "save"
  | "list"
  | "complete"
  | "uncomplete"
  | "delete"
  | "update"
  | "dashboard_link"
  | "profile_memory"
  | "multi_bubble"
  | "ambiguous"
  | "error_path";

/**
 * One eval scenario. Self-contained — the runner only needs `userText`
 * and `preState` to replay it; `expected` is for scoring.
 */
export type TestCase = {
  id: string;
  category: CaseCategory;
  /** One-line human description. Shown in the report. */
  description: string;
  /** What the user typed (Thai by default). */
  userText: string;
  /** Optional prior conversation — same shape `loadMemory` returns. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Pre-loaded todos + user memory for this case. */
  preState: {
    pending?: TodoFixture[];
    done?: TodoFixture[];
    userMemory?: UserMemoryFixture;
  };
  expected: {
    /** Tool names that MUST appear, in order. Extra tools allowed unless `exact:true`. */
    toolsCalled: string[];
    /** Set true if the agent should call ONLY these tools (no more). */
    exact?: boolean;
    /**
     * Per-tool arg assertions. Keyed by tool name. Value is a predicate
     * over the captured args. Multiple calls to the same tool are matched
     * positionally (predicate[0] checks first call, etc).
     */
    toolArgs?: Record<string, ((args: unknown) => boolean)[]>;
    /** Final reply text MUST match (any one of) these regexes. */
    replyMatches?: RegExp[];
    /** Final reply text must NOT match these regexes. */
    replyMustNot?: RegExp[];
    /** Expected bubble count (text + flex combined). */
    bubbleCount?: number;
    /** Specific flex template names the agent should use. */
    flexTemplates?: string[];
    /** If true, agent should NOT call save_memory (e.g. ambiguous text). */
    mustNotSave?: boolean;
  };
};

/** Result of replaying one case through one model. */
export type CaseRun = {
  caseId: string;
  model: string;
  /** All tool invocations captured by the mock tool wrappers, in order. */
  toolCalls: {
    name: string;
    args: unknown;
    /** Mock result handed back to the model. */
    result: unknown;
  }[];
  /** Free-form text the model produced (last assistant message + multi-bubble text). */
  text: string;
  /** All LINE bubbles (text or flex) recorded via send_*_reply tools. */
  bubbles: { type: "text" | "flex"; text?: string; template?: string }[];
  meta: {
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
    cacheRead: number;
    costUsd: number;
    steps: number;
  };
  error?: string;
};

/** Per-case scoring (one row in the report). */
export type CaseScore = {
  caseId: string;
  category: CaseCategory;
  description: string;
  toolMatch: "pass" | "fail";
  toolArgsMatch: "pass" | "fail" | "n/a";
  replyMatch: "pass" | "fail" | "n/a";
  bubbleCountMatch: "pass" | "fail" | "n/a";
  judge?: { equivalent: "yes" | "partial" | "no"; reason: string };
  costDeltaPct?: number;
  latencyDeltaPct?: number;
  notes: string[];
};

/** Top-level eval summary. */
export type EvalReport = {
  startedAt: string;
  finishedAt: string;
  baseline: { model: string; results: CaseRun[] };
  candidate: { model: string; results: CaseRun[] };
  scores: CaseScore[];
  totals: {
    cases: number;
    toolMatchPass: number;
    replyJudgeYesOrPartial: number;
    costBaselineUsd: number;
    costCandidateUsd: number;
    costDeltaPct: number;
    latencyP50BaselineMs: number;
    latencyP50CandidateMs: number;
  };
};
