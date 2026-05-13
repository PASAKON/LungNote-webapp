# LungNote Agent Eval

Offline harness for comparing two LLMs (e.g. Sonnet 4.5 vs Haiku 4.5)
on the LungNote agent's real tool surface — without hitting prod
Supabase or sending LINE replies.

## What it does

1. **Replays** a curated corpus of Thai user turns through the agent
   prompt + tool catalog, **mocked** end-to-end (no DB writes, no LINE
   calls).
2. **Captures** every tool call, every reply bubble, token usage,
   latency, cost per case.
3. **Compares** two runs side by side:
   - tool name set match
   - tool argument predicates
   - reply regex match
   - LLM judge (a stronger model) decides reply equivalence
4. **Reports** Markdown table with pass rates, cost Δ, latency Δ,
   per-case detail + failure callouts.

## Files

| File | Role |
|---|---|
| `cases.ts` | The corpus — curated test scenarios |
| `mock-tools.ts` | In-memory Vercel AI SDK tools mirroring the prod set |
| `model-factory.ts` | Anthropic-direct / OpenRouter model wiring (eval-side) |
| `runner.ts` | Main: replays cases through one or two models, writes JSONL |
| `judge.ts` | LLM judge: scores reply equivalence |
| `report.ts` | Markdown summary generator |
| `types.ts` | Shared types |

## Quick start

```bash
# 1. Run baseline + candidate side-by-side
pnpm tsx --env-file=.env.local scripts/eval/runner.ts \
  --baseline anthropic/claude-sonnet-4-5 \
  --candidate anthropic/claude-haiku-4-5 \
  --out eval/results/run-1

# 2. Score replies with a stronger judge
pnpm tsx --env-file=.env.local scripts/eval/judge.ts \
  --baseline eval/results/run-1/baseline.jsonl \
  --candidate eval/results/run-1/candidate.jsonl \
  --judge anthropic/claude-sonnet-4-5 \
  --out eval/results/run-1/judge.jsonl

# 3. Generate the Markdown report
pnpm tsx --env-file=.env.local scripts/eval/report.ts \
  --baseline eval/results/run-1/baseline.jsonl \
  --candidate eval/results/run-1/candidate.jsonl \
  --judge eval/results/run-1/judge.jsonl \
  --out eval/results/run-1/report.md

cat eval/results/run-1/report.md
```

## Subset / smoke test

```bash
# Run just 3 cases against one model — useful to validate the harness:
pnpm tsx --env-file=.env.local scripts/eval/runner.ts \
  --candidate anthropic/claude-haiku-4-5 \
  --cases save_simple_no_date,list_pending_three_items,delete_position_2 \
  --out /tmp/eval-smoke
```

## Adding a case

1. Add an entry to `CURATED_CASES` in `cases.ts`.
2. Pick a `category` from the existing set; describe the scenario in
   one sentence.
3. Fill `preState` with whatever the user's todo list / memory should
   look like before the message.
4. Write `expected`:
   - `toolsCalled` — names that MUST appear (order-tolerant unless
     `exact:true`).
   - `toolArgs` — per-tool predicate array; n-th predicate checks n-th
     call to that tool.
   - `replyMatches` — at least one of these regex must hit.
   - `replyMustNot` — none of these may hit.
   - `mustNotSave: true` — useful for ambiguity / greeting cases.

Run the harness; if the case behaves as expected on the baseline,
commit. If not, fix the predicate (your expectation might be wrong).

## Cost

A full sweep (currently ~30 cases) is roughly:

- Sonnet 4.5 baseline:  ~$0.30
- Haiku 4.5 candidate:  ~$0.10
- Sonnet judge:         ~$0.10

Total ≈ $0.50 per full eval run. Cheap enough to run on every PR
that touches the agent prompt or tool set.

## Limits

- Mock tools mirror the real ones at the schema level, but not 100% of
  the runtime quirks (e.g. real `complete_by_position` re-fetches the
  pending list mid-turn). If a behavioral edge depends on a tool's
  internal Supabase access pattern, the eval may miss it.
- The judge is opinionated; a single judge call per case is fine for
  rough ranking but flips on borderline cases. For higher confidence,
  run the judge 3x per case and take majority vote (not implemented
  yet — see future work).
- No real-history corpus yet. PR #2 will append `fetch-real.ts` that
  samples + redacts from `lungnote_traces`.
