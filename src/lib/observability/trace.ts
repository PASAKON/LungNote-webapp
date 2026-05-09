import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Chat trace collector — feeds the admin.lungnote.com debug viewer.
 *
 * Each LINE webhook turn gets one TraceCollector instance. Throughout the
 * pipeline we call `step()` (writes a structured console line + buffers an
 * event) and `recordTool()` (buffers tool call detail). At the end of the
 * turn the handler calls `finalize()` which fire-and-forget inserts a
 * single row into lungnote_chat_traces.
 *
 * Insert is best-effort — never block the LINE reply on it.
 */

export type TracePath =
  | "dashboard"
  | "list"
  | "memory"
  | "regex"
  | "ai"
  | "error";

export type TraceToolCall = {
  name: string;
  args: unknown;
  result: unknown;
};

export type TraceMeta = {
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  latency_ms?: number;
  // free-form additional fields per path
  [k: string]: unknown;
};

type FinalizeOpts = {
  path: TracePath;
  replyText?: string | null;
  meta?: TraceMeta;
  error?: string;
  historyCount?: number;
  aiIterations?: number;
};

export class TraceCollector {
  private toolCalls: TraceToolCall[] = [];
  private startedAt: number;
  public historyCount = 0;
  public aiIterations = 0;

  constructor(
    public readonly traceId: string,
    public readonly lineUserId: string | undefined,
    public readonly userText: string,
  ) {
    this.startedAt = Date.now();
    this.step("turn_start", { user_text_len: userText.length });
  }

  /**
   * Emit a single structured log line. Read these via Vercel Functions logs
   * by filtering on `trace_id`. Cheap + immediate; complements the DB row
   * which only lands after finalize().
   */
  step(name: string, data: Record<string, unknown> = {}): void {
    const line = JSON.stringify({
      ts: Date.now(),
      trace_id: this.traceId,
      step: name,
      line_user_id: this.lineUserId,
      ...data,
    });
    console.log(line);
  }

  recordTool(name: string, args: unknown, result: unknown): void {
    this.toolCalls.push({ name, args, result });
    this.step("tool_call", { name, args_keys: Object.keys((args as object) ?? {}) });
  }

  /** Read-only view of the tool calls buffered this turn. Used by tests. */
  getToolCalls(): readonly TraceToolCall[] {
    return this.toolCalls;
  }

  /**
   * Persist the trace row. Returns synchronously after kicking off the insert.
   * Errors are logged but never thrown — DB outage must not affect the reply.
   */
  finalize(opts: FinalizeOpts): void {
    const latencyMs = Date.now() - this.startedAt;
    const meta: TraceMeta = { ...(opts.meta ?? {}), latency_ms: latencyMs };
    this.step("turn_end", {
      path: opts.path,
      latency_ms: latencyMs,
      tool_calls: this.toolCalls.length,
      iterations: opts.aiIterations ?? this.aiIterations,
      error: opts.error ?? undefined,
    });

    void insertTrace({
      traceId: this.traceId,
      lineUserId: this.lineUserId,
      userText: this.userText,
      path: opts.path,
      historyCount: opts.historyCount ?? this.historyCount,
      aiIterations: opts.aiIterations ?? this.aiIterations,
      toolCalls: this.toolCalls,
      replyText: opts.replyText ?? null,
      meta,
      error: opts.error ?? null,
    }).catch((err: unknown) => {
      console.error("trace insert failed", { traceId: this.traceId, err });
    });
  }
}

async function insertTrace(row: {
  traceId: string;
  lineUserId: string | undefined;
  userText: string;
  path: TracePath;
  historyCount: number;
  aiIterations: number;
  toolCalls: TraceToolCall[];
  replyText: string | null;
  meta: TraceMeta;
  error: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("lungnote_chat_traces").insert({
    trace_id: row.traceId,
    line_user_id: row.lineUserId ?? null,
    user_text: row.userText.slice(0, 4000), // hard cap
    path: row.path,
    history_count: row.historyCount,
    ai_iterations: row.aiIterations,
    tool_calls: row.toolCalls.length > 0 ? row.toolCalls : null,
    reply_text: row.replyText?.slice(0, 4000) ?? null,
    meta: row.meta,
    error_text: row.error,
  });
  if (error) {
    throw new Error(`insertTrace: ${error.message}`);
  }
}
