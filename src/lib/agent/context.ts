import "server-only";
import type { TraceCollector } from "@/lib/observability/trace";
import type { LineMessage } from "@/lib/line/client";
import type { BulkOpKind } from "@/lib/agent/bulk_guard";
import { shouldRequireConfirmation } from "@/lib/agent/bulk_guard";

/**
 * Per-turn working memory for the agent runtime. Holds state that survives
 * across tool calls within a single LINE webhook event but resets next turn.
 *
 * Why this exists: the previous "tool-using LLM" design relied on Gemini to
 * remember what it had listed and which UUIDs went with which positions.
 * That fails (stale ids, position confusion). With TurnContext, the SERVER
 * holds list state — AI just calls `*_by_position(n)` and the server
 * resolves n → UUID against the cached list.
 *
 * Lifecycle: created at the start of handleText, passed into every tool
 * execute via the registry, garbage-collected when the webhook returns.
 */
export type AgentTodoItem = {
  id: string;
  text: string;
  due_at: string | null;
  due_text: string | null;
  created_at: string;
};

export class TurnContext {
  /** Open todos cached by the most recent list_pending call this turn. */
  private pendingList: AgentTodoItem[] | null = null;
  /** Done todos cached by the most recent list_done call this turn. */
  private doneList: AgentTodoItem[] | null = null;

  // ── Bulk guard state ────────────────────────────────────────────────
  /**
   * Count of bulk op tool calls (complete/delete/uncomplete) announced
   * synchronously in this turn before any awaits. All parallel tool
   * executions increment this before yielding, so post-await checks see
   * the full turn count.
   */
  private _bulkOpCount = 0;
  private _bulkConfirmed = false;
  /** Accumulated successful bulk op ids per op kind for undo recording. */
  private _bulkOpLog = new Map<BulkOpKind, string[]>();

  /**
   * In-flight auto-list promises. When two parallel *_by_position tool
   * calls race to populate the cache (e.g. delete_by_position(3) and
   * delete_by_position(5) in the same model response), they share one
   * underlying list_pending fetch. Each tool awaits the same promise;
   * whoever finishes first stores the result.
   */
  pendingListPromise: Promise<unknown> | null = null;
  doneListPromise: Promise<unknown> | null = null;

  constructor(
    public readonly lineUserId: string | null,
    public readonly trace: TraceCollector,
  ) {}

  // ── Pending list ────────────────────────────────────────────────────
  setPendingList(items: AgentTodoItem[]): void {
    this.pendingList = items;
  }
  hasPendingList(): boolean {
    return this.pendingList !== null;
  }
  getPendingByPosition(position: number): AgentTodoItem | null {
    if (!this.pendingList) return null;
    if (!Number.isInteger(position) || position < 1) return null;
    return this.pendingList[position - 1] ?? null;
  }
  pendingCount(): number {
    return this.pendingList?.length ?? 0;
  }

  // ── Done list ───────────────────────────────────────────────────────
  setDoneList(items: AgentTodoItem[]): void {
    this.doneList = items;
  }
  hasDoneList(): boolean {
    return this.doneList !== null;
  }
  getDoneByPosition(position: number): AgentTodoItem | null {
    if (!this.doneList) return null;
    if (!Number.isInteger(position) || position < 1) return null;
    return this.doneList[position - 1] ?? null;
  }

  // ── Bulk guard API ─────────────────────────────────────────────────
  /**
   * Synchronously announce intent to run a bulk op. MUST be called as the
   * very first statement in execute() — before any await — so all parallel
   * tool calls in one model step increment the counter before any of them
   * checks shouldBlockBulk().
   */
  announceBulkOp(_opKind: BulkOpKind): void {
    this._bulkOpCount++;
  }

  getBulkOpCount(): number {
    return this._bulkOpCount;
  }

  setBulkConfirmed(val: boolean): void {
    this._bulkConfirmed = val;
  }

  isBulkConfirmed(): boolean {
    return this._bulkConfirmed;
  }

  /**
   * Returns true if the turn's bulk op count meets the guard threshold and
   * the user has not yet confirmed. Check AFTER the first async barrier in
   * execute() — by then all parallel calls have announced.
   */
  shouldBlockBulk(): boolean {
    return shouldRequireConfirmation(this._bulkOpCount, "complete") && !this._bulkConfirmed;
  }

  /** Record a successful bulk op id for end-of-turn undo persistence. */
  pushBulkOpId(opKind: BulkOpKind, todoId: string): void {
    const ids = this._bulkOpLog.get(opKind) ?? [];
    ids.push(todoId);
    this._bulkOpLog.set(opKind, ids);
  }

  /**
   * Returns accumulated bulk op log (opKind → todoIds[]) and clears the
   * buffer. Returns null when nothing was recorded.
   */
  drainBulkOpLog(): Map<BulkOpKind, string[]> | null {
    if (this._bulkOpLog.size === 0) return null;
    const snapshot = new Map(this._bulkOpLog);
    this._bulkOpLog.clear();
    return snapshot;
  }

  // ── Reply buffer (multi-bubble) ─────────────────────────────────────
  /**
   * When the agent calls `send_text_reply` or `send_flex_reply` one or
   * more times, each call pushes one LINE message onto this buffer. The
   * webhook flushes the buffer into a single LINE reply payload (mixed
   * text + flex). LINE caps a reply at 5 messages — the tools reject
   * calls past that.
   */
  private replyBuffer: LineMessage[] = [];
  /** LINE allows max 5 messages per replyMessage / pushMessage call. */
  static readonly MAX_BUBBLES = 5;

  /** Push one text bubble. Returns ok:false when cap reached. */
  pushReplyText(text: string): { ok: boolean; reason?: string } {
    if (this.replyBuffer.length >= TurnContext.MAX_BUBBLES) {
      return { ok: false, reason: "bubble_limit_reached" };
    }
    this.replyBuffer.push({ type: "text", text });
    return { ok: true };
  }

  /** Push one flex bubble. Returns ok:false when cap reached. */
  pushReplyFlex(msg: LineMessage): { ok: boolean; reason?: string } {
    if (this.replyBuffer.length >= TurnContext.MAX_BUBBLES) {
      return { ok: false, reason: "bubble_limit_reached" };
    }
    this.replyBuffer.push(msg);
    return { ok: true };
  }

  /**
   * Back-compat alias — pre-flex code called `pushReply(text)` for text
   * bubbles. Keep so the old text tool keeps working without churn.
   */
  pushReply(text: string): { ok: boolean; reason?: string } {
    return this.pushReplyText(text);
  }

  getReplyBubbles(): LineMessage[] {
    return [...this.replyBuffer];
  }
  hasReplyBubbles(): boolean {
    return this.replyBuffer.length > 0;
  }
}
