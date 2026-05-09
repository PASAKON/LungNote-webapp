import "server-only";
import type { TraceCollector } from "@/lib/observability/trace";

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

  // ── Reply buffer (multi-bubble) ─────────────────────────────────────
  /**
   * When the agent calls `send_text_reply` one or more times, each call
   * pushes a bubble here. The webhook flushes the buffer into a single
   * LINE reply with multiple text messages. LINE caps a reply payload at
   * 5 messages — the tool itself rejects calls past that.
   */
  private replyBuffer: string[] = [];
  /** LINE allows max 5 messages per replyMessage / pushMessage call. */
  static readonly MAX_BUBBLES = 5;

  pushReply(text: string): { ok: boolean; reason?: string } {
    if (this.replyBuffer.length >= TurnContext.MAX_BUBBLES) {
      return { ok: false, reason: "bubble_limit_reached" };
    }
    this.replyBuffer.push(text);
    return { ok: true };
  }
  getReplyBubbles(): string[] {
    return [...this.replyBuffer];
  }
  hasReplyBubbles(): boolean {
    return this.replyBuffer.length > 0;
  }
}
