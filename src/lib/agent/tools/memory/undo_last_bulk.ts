import "server-only";
import { z } from "zod";
import { getLastBulkOp, clearLastBulkOp } from "@/lib/memory/bulk_ops";
import { completeMemory, uncompleteMemory } from "@/lib/memory/mutate";
import type { AgentTool } from "../../tool";

export const undoLastBulkTool: AgentTool<Record<string, never>> = {
  name: "undo_last_bulk",
  category: "memory",
  description:
    "Undo the most recent bulk complete/uncomplete op (within 10 min). Use when user says 'เอากลับ' / 'undo' / 'ยกเลิก' / 'recall' after a bulk op. Does NOT undo deletes (irreversible).",
  schema: z.object({}),
  requires: ["linked"],
  async execute(_input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };

    const bulkOp = await getLastBulkOp(ctx.lineUserId);
    if (!bulkOp) {
      return {
        ok: false,
        reason: "no_recent_bulk_op",
        message: "No bulk op found within the last 10 minutes to undo.",
      };
    }

    if (bulkOp.op_kind === "delete") {
      return { ok: false, reason: "deletes_are_irreversible" };
    }

    // Reverse the op: complete → uncomplete, uncomplete → complete
    const reverseFn =
      bulkOp.op_kind === "complete" ? uncompleteMemory : completeMemory;

    const results = await Promise.all(
      bulkOp.todo_ids.map((id) => reverseFn(ctx.lineUserId!, id)),
    );

    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    if (succeeded.length > 0) {
      await clearLastBulkOp(ctx.lineUserId, bulkOp.id);
    }

    const texts = succeeded
      .filter((r): r is { ok: true; todoId: string; text: string } => r.ok)
      .map((r) => r.text);

    if (succeeded.length === 0) {
      return {
        ok: false as const,
        reason: "undo_failed",
        reversed: 0,
        failed: failed.length,
        op_kind: bulkOp.op_kind,
      };
    }

    return {
      ok: true as const,
      reversed: succeeded.length,
      failed: failed.length,
      op_kind: bulkOp.op_kind,
      texts,
    };
  },
};
