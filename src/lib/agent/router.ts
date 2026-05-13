/**
 * Intent router — picks a model id for the current turn.
 *
 * NOTE: no `"server-only"` import — the eval harness imports this
 * directly under tsx to mirror prod routing.
 *
 * Defaults to the env's `LLM_MODEL` (Flash, cheap, ~84% Sonnet parity).
 * Escalates to `ROUTER_COMPLEX_MODEL` (Gemini 2.5 Pro by default — 96%
 * Sonnet parity but ~3× slower + ~22× cost) when the user's message
 * matches one of the patterns Flash empirically fails on (verified
 * against the 31-case eval corpus in `eval/baselines/`):
 *
 *   1. Update verbs with a new value — "เลื่อน", "แก้", "เปลี่ยน",
 *      "ย้าย", "rename" — Flash often refuses these as ambiguous even
 *      when position + new value are both explicit.
 *   2. List-then-mutate in one turn — multiple position-like tokens
 *      ("ลบ 1 กับ 3", "ติ๊ก 2 และ 4") — Flash sometimes stops after
 *      the first action.
 *   3. Long Thai messages (>150 chars) — Flash truncates intent on
 *      multi-clause inputs.
 *   4. Profile facts about user identity — caught by the stable-fact
 *      rule in the system prompt, but Pro is more reliable about
 *      calling `update_memory`.
 *
 * The router runs in O(1) — no LLM classifier, just regex/length
 * heuristics. Cost: zero extra tokens. Latency: < 1 ms. Failure mode:
 * misclassify simple turns as complex → pay Pro cost when we didn't
 * need to (still cheaper than Sonnet); misclassify complex as simple
 * → user sees Flash's existing weakness, same as today. Both safe.
 *
 * Toggle via `LLM_ROUTER_ENABLED=true` env. When off, the runtime
 * uses `LLM_MODEL` unconditionally (current behavior).
 */

export type RouteDecision = {
  /** Model id resolved for this turn. */
  modelId: string;
  /** Why this model was chosen. Recorded in the trace for observability. */
  reason:
    | "router_disabled"
    | "default"
    | "update_verb"
    | "multi_position"
    | "long_message"
    | "profile_fact"
    | "complex_clause";
};

const DEFAULT_FAST_MODEL = "google/gemini-2.5-flash";
const DEFAULT_COMPLEX_MODEL = "google/gemini-2.5-pro";

/** Thai update verbs that combined with a value need strong tool-call. */
const UPDATE_VERB_RE = /(?:เลื่อน|แก้|เปลี่ยน|ย้าย|อัพเดท|อัปเดต|update|rename)/i;

/** Profile-fact phrases — explicit identity statements. */
const PROFILE_RE = /(?:ฉันชื่อ|ผมชื่อ|เรียกฉัน|เรียกผม|ฉันอยู่|ผมอยู่|ฉันเรียน|ผมเรียน|อายุฉัน|อายุผม|วันเกิด)/;

/** Multi-step / multiple-position markers. */
const MULTI_POS_RE = /(?:และ|กับ|พร้อมกัน|ทั้ง|ที่ละ)/;

/** Soft cap on length — long Thai sentences carry multi-intent. */
const LONG_THRESHOLD = 150;

export function routeModel(userText: string): RouteDecision {
  if (process.env.LLM_ROUTER_ENABLED !== "true") {
    const fallback =
      (process.env.LLM_MODEL ?? DEFAULT_FAST_MODEL).trim() || DEFAULT_FAST_MODEL;
    return { modelId: fallback, reason: "router_disabled" };
  }

  const fast = (process.env.ROUTER_FAST_MODEL ?? DEFAULT_FAST_MODEL).trim();
  const complex =
    (process.env.ROUTER_COMPLEX_MODEL ?? DEFAULT_COMPLEX_MODEL).trim();

  const text = userText.trim();
  if (text.length === 0) return { modelId: fast, reason: "default" };

  if (UPDATE_VERB_RE.test(text)) {
    return { modelId: complex, reason: "update_verb" };
  }

  if (PROFILE_RE.test(text)) {
    return { modelId: complex, reason: "profile_fact" };
  }

  // Multi-position: count numbers + a connector word ("และ" / "กับ"
  // / "พร้อม"). A single number is fine (single-position mutation).
  const numbers = text.match(/\d+/g) ?? [];
  if (numbers.length >= 2 && MULTI_POS_RE.test(text)) {
    return { modelId: complex, reason: "multi_position" };
  }

  if (text.length > LONG_THRESHOLD) {
    return { modelId: complex, reason: "long_message" };
  }

  // Multi-clause: two distinct action verbs joined by a clause marker.
  // We restrict the trigger to the connector "แล้ว" preceded by a list-
  // verb ("ดู") AND followed by a mutation verb ("ติ๊ก", "ลบ", "แก้")
  // to avoid the very common completed-phrase pattern "เสร็จแล้ว".
  if (/(?:ดู|ลิสต์)[^]*?แล้ว[^]*?(?:ติ๊ก|ลบ|แก้|complete|delete|update)/.test(text)) {
    return { modelId: complex, reason: "complex_clause" };
  }

  return { modelId: fast, reason: "default" };
}
