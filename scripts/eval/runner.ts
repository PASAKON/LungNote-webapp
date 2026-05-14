/**
 * Eval runner — replays a fixed corpus through two models and emits
 * per-case results as JSONL.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/eval/runner.ts \
 *     --baseline anthropic/claude-sonnet-4-5 \
 *     --candidate anthropic/claude-haiku-4-5 \
 *     --out eval/results/run-1
 *
 * Or run a single model (no comparison, just capture):
 *   pnpm tsx --env-file=.env.local scripts/eval/runner.ts \
 *     --candidate anthropic/claude-haiku-4-5 \
 *     --out eval/results/haiku-only
 *
 * Outputs (inside --out dir):
 *   - baseline.jsonl     one CaseRun JSON per line
 *   - candidate.jsonl    one CaseRun JSON per line
 *   - meta.json          run metadata (seed, started/finished, costs)
 *
 * The runner is intentionally side-effect free for prod:
 *   - No Supabase writes  (mock tools only)
 *   - No LINE replies     (bubbles captured in-process)
 *   - No memory persisted (each case gets a fresh state)
 */

import { generateText, type ModelMessage } from "ai";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ALL_CASES } from "./cases";
import { buildMockToolSet, CallRecorder, makeMockState } from "./mock-tools";
import { resolveEvalModel, type EvalModel } from "./model-factory";
import { buildStaticSystemPrompt, buildTodayBlock } from "../../src/lib/agent/prompt";
import { routeModel } from "../../src/lib/agent/router";
import type { CaseRun, TestCase } from "./types";

const MAX_STEPS = 5;
const MAX_OUTPUT_TOKENS = 1024;

// ── CLI parsing ────────────────────────────────────────────────────────

type CliArgs = {
  baseline?: string;
  candidate: string;
  outDir: string;
  caseIds?: string[];
  limit?: number;
  /** Enable the production intent router (router.ts) per turn. */
  router: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string | undefined> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = "true";
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  if (!args.candidate) {
    throw new Error("--candidate <model> is required (e.g. anthropic/claude-haiku-4-5)");
  }
  return {
    baseline: args.baseline,
    candidate: args.candidate,
    outDir: args.out ?? `eval/results/run-${Date.now()}`,
    caseIds: args.cases?.split(",").filter(Boolean),
    limit: args.limit ? Number(args.limit) : undefined,
    router: args.router === "true",
  };
}

// ── Per-case run ───────────────────────────────────────────────────────

/**
 * Replay one TestCase through one model. No DB, no LINE — mock tools
 * capture intent into a `CallRecorder` + bubble buffer.
 */
async function runCase(
  c: TestCase,
  em: EvalModel,
  opts: { routerEnabled: boolean; fastModel: string; complexModel: string },
): Promise<CaseRun> {
  // If router is enabled, route on the user text and resolve the right
  // model for this turn. Otherwise honor the caller's `em` as-is.
  let model = em;
  let routeReason: string | null = null;
  if (opts.routerEnabled) {
    // Set env vars so router.ts (no DI) picks them up.
    process.env.LLM_ROUTER_ENABLED = "true";
    process.env.ROUTER_FAST_MODEL = opts.fastModel;
    process.env.ROUTER_COMPLEX_MODEL = opts.complexModel;
    const decision = routeModel(c.userText);
    routeReason = decision.reason;
    if (decision.modelId !== em.modelId) {
      model = resolveEvalModel(decision.modelId);
    }
  }
  const state = makeMockState({
    pending: c.preState.pending,
    done: c.preState.done,
    userMemory: c.preState.userMemory,
  });
  const rec = new CallRecorder();
  const tools = buildMockToolSet(state, rec);

  // System prompt — same as runtime, split into cached + dynamic.
  const staticPrompt = buildStaticSystemPrompt();
  const todayBlock = buildTodayBlock(new Date());
  const userMemBlock =
    Object.keys(c.preState.userMemory ?? {}).length > 0
      ? "User memory:\n" +
        Object.entries(c.preState.userMemory!)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")
      : "User memory: (none)";
  const dynamicPrompt = `${todayBlock}\n\n${userMemBlock}`;

  const systemMessages: ModelMessage[] =
    model.supportsCache && model.cacheProviderKey
      ? [
          {
            role: "system",
            content: staticPrompt,
            providerOptions: {
              [model.cacheProviderKey]: { cacheControl: { type: "ephemeral" } },
            },
          },
          { role: "system", content: dynamicPrompt },
        ]
      : [{ role: "system", content: staticPrompt + "\n\n" + dynamicPrompt }];

  const history: ModelMessage[] = (c.history ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages: ModelMessage[] = [
    ...systemMessages,
    ...history,
    { role: "user", content: c.userText },
  ];

  const start = Date.now();
  try {
    const result = await generateText({
      model: model.model,
      messages,
      tools,
      stopWhen: ({ steps }) => steps.length >= MAX_STEPS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    const latencyMs = Date.now() - start;

    const tokensIn = result.usage?.inputTokens ?? 0;
    const tokensOut = result.usage?.outputTokens ?? 0;
    const costUsd =
      (tokensIn * model.priceInputPerM + tokensOut * model.priceOutputPerM) / 1_000_000;

    const providerMeta =
      (result.providerMetadata as
        | {
            anthropic?: { cacheReadInputTokens?: number };
            openrouter?: {
              usage?: { promptTokensDetails?: { cachedTokens?: number } };
            };
          }
        | undefined) ?? undefined;
    const cacheRead =
      providerMeta?.anthropic?.cacheReadInputTokens ??
      providerMeta?.openrouter?.usage?.promptTokensDetails?.cachedTokens ??
      0;

    // Mirror the runtime's empty-reply retry: when the agent ends the
    // turn after a read-only tool call (list_pending / list_done)
    // without producing a bubble, retry once with the complex model
    // using only the reply tools. See `src/lib/agent/runtime.ts`
    // for the production version. We replay the same guard here so the
    // eval reflects the prod codepath.
    let retryTokensIn = 0;
    let retryTokensOut = 0;
    let retryCostUsd = 0;
    const retryEnabled = process.env.LLM_REPLY_RETRY_ENABLED !== "false";
    const priorToolNames = rec.calls.map((t) => t.name);
    const allReadOnly = priorToolNames.every(
      (n) => n === "list_pending" || n === "list_done",
    );
    if (
      state.bubbles.length === 0 &&
      priorToolNames.length > 0 &&
      allReadOnly &&
      retryEnabled &&
      opts.routerEnabled &&
      model.modelId !== opts.complexModel
    ) {
      const complexModel = resolveEvalModel(opts.complexModel);
      // Build a reply-only tool subset by name.
      const fullTools = buildMockToolSet(state, rec);
      const replyOnlyTools = {
        send_text_reply: fullTools.send_text_reply,
        send_flex_reply: fullTools.send_flex_reply,
      };
      try {
        const retryResult = await generateText({
          model: complexModel.model,
          messages: [
            ...messages,
            ...result.response.messages,
            {
              role: "user",
              content:
                "ตอบ user ตอนนี้เลย ใช้ผลของ tool ก่อนหน้า — เรียก send_flex_reply หรือ send_text_reply อย่างเดียว ห้ามเรียก tool อื่นอีก.",
            },
          ],
          tools: replyOnlyTools,
          stopWhen: ({ steps }) => steps.length >= 2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        });
        retryTokensIn = retryResult.usage?.inputTokens ?? 0;
        retryTokensOut = retryResult.usage?.outputTokens ?? 0;
        retryCostUsd =
          (retryTokensIn * complexModel.priceInputPerM +
            retryTokensOut * complexModel.priceOutputPerM) /
          1_000_000;
        const retryFallback = (retryResult.text ?? "").trim();
        if (state.bubbles.length === 0 && retryFallback) {
          state.bubbles.push({ type: "text", text: retryFallback });
        }
      } catch {
        // Retry failure is non-fatal — fall through to the empty-bubble
        // path so the report flags this case.
      }
    }

    // If agent used multi-bubble tools, prefer bubbles. Otherwise the
    // free-form text counts as one text bubble.
    const fallback = (result.text ?? "").trim();
    if (state.bubbles.length === 0 && fallback) {
      state.bubbles.push({ type: "text", text: fallback });
    }

    return {
      caseId: c.id,
      // Record the actual model the router picked, not the caller's
      // candidate. The report uses this to surface per-case routing.
      model: routeReason ? `${model.modelId} (route:${routeReason})` : model.modelId,
      toolCalls: rec.calls,
      text: state.bubbles
        .map((b) => (b.type === "text" ? b.text ?? "" : `[flex:${b.template}]`))
        .join("\n"),
      bubbles: state.bubbles,
      meta: {
        latencyMs,
        tokensIn: tokensIn + retryTokensIn,
        tokensOut: tokensOut + retryTokensOut,
        cacheRead,
        costUsd: costUsd + retryCostUsd,
        steps: result.steps?.length ?? 1,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      caseId: c.id,
      model: routeReason ? `${model.modelId} (route:${routeReason})` : model.modelId,
      toolCalls: rec.calls,
      text: "",
      bubbles: state.bubbles,
      meta: {
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        cacheRead: 0,
        costUsd: 0,
        steps: 0,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Sweep ──────────────────────────────────────────────────────────────

async function runSweep(
  modelId: string,
  cases: TestCase[],
  out: string,
  label: string,
  routerOpts: { enabled: boolean; fastModel: string; complexModel: string },
): Promise<{ total: number; cost: number; latencyP50: number; durationMs: number }> {
  const em = resolveEvalModel(modelId);
  const startedAt = Date.now();
  const runs: CaseRun[] = [];
  for (const [i, c] of cases.entries()) {
    const r = await runCase(c, em, {
      routerEnabled: routerOpts.enabled,
      fastModel: routerOpts.fastModel,
      complexModel: routerOpts.complexModel,
    });
    runs.push(r);
    const status = r.error ? `❌ ${r.error.slice(0, 60)}` : "✅";
    console.log(
      `[${label}] ${i + 1}/${cases.length} ${c.id.padEnd(34)} ${status}  ` +
        `tools=${r.toolCalls.map((t) => t.name).join(",") || "-"}  ` +
        `$${r.meta.costUsd.toFixed(5)}  ${r.meta.latencyMs}ms`,
    );
  }
  const lines = runs.map((r) => JSON.stringify(r)).join("\n");
  await writeFile(out, lines + "\n", "utf8");

  const totalCost = runs.reduce((s, r) => s + r.meta.costUsd, 0);
  const latencies = runs.map((r) => r.meta.latencyMs).sort((a, b) => a - b);
  const latencyP50 = latencies[Math.floor(latencies.length / 2)] ?? 0;
  return {
    total: runs.length,
    cost: totalCost,
    latencyP50,
    durationMs: Date.now() - startedAt,
  };
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  let cases = ALL_CASES;
  if (args.caseIds && args.caseIds.length > 0) {
    const ids = new Set(args.caseIds);
    cases = cases.filter((c) => ids.has(c.id));
  }
  if (args.limit) cases = cases.slice(0, args.limit);

  await mkdir(args.outDir, { recursive: true });

  console.log(`\n▶ Eval — ${cases.length} cases\n`);

  // Router options: `--router` enables prod-style routing; fast/complex
  // models come from env or hardcoded defaults. The candidate model id
  // doubles as the fast model when the router is on.
  const routerOpts = {
    enabled: args.router,
    fastModel: args.candidate,
    complexModel: process.env.ROUTER_COMPLEX_MODEL ?? "google/gemini-2.5-pro",
  };
  if (args.router) {
    console.log(
      `Router ON: fast=${routerOpts.fastModel} complex=${routerOpts.complexModel}`,
    );
  }

  let baselineSummary: Awaited<ReturnType<typeof runSweep>> | null = null;
  if (args.baseline) {
    console.log(`Baseline: ${args.baseline}`);
    baselineSummary = await runSweep(
      args.baseline,
      cases,
      path.join(args.outDir, "baseline.jsonl"),
      "B",
      { enabled: false, fastModel: args.baseline, complexModel: routerOpts.complexModel },
    );
  }

  console.log(`\nCandidate: ${args.candidate}`);
  const candidateSummary = await runSweep(
    args.candidate,
    cases,
    path.join(args.outDir, "candidate.jsonl"),
    "C",
    routerOpts,
  );

  const meta = {
    finishedAt: new Date().toISOString(),
    cases: cases.length,
    baseline: args.baseline
      ? {
          model: args.baseline,
          totalCostUsd: baselineSummary!.cost,
          latencyP50Ms: baselineSummary!.latencyP50,
          durationMs: baselineSummary!.durationMs,
        }
      : null,
    candidate: {
      model: args.candidate,
      totalCostUsd: candidateSummary.cost,
      latencyP50Ms: candidateSummary.latencyP50,
      durationMs: candidateSummary.durationMs,
    },
  };
  await writeFile(
    path.join(args.outDir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8",
  );

  console.log(`\n✅ Done. Results: ${args.outDir}`);
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
