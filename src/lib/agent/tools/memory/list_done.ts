import "server-only";
import { z } from "zod";
import { listDoneFromLine } from "@/lib/memory/list";
import type { AgentTool } from "../../tool";

const args = z.object({}).strict();

export const listDoneTool: AgentTool<z.infer<typeof args>> = {
  name: "list_done",
  category: "memory",
  description:
    "Read recently-completed todos. Use only to find a done item to uncomplete. Server caches the list; afterwards use uncomplete_by_position.",
  schema: args,
  requires: ["linked"],
  async execute(_input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const result = await listDoneFromLine(ctx.lineUserId);
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    ctx.setDoneList(
      result.items.map((it) => ({
        id: it.id,
        text: it.text,
        due_at: it.due_at,
        due_text: it.due_text,
        created_at: it.created_at,
      })),
    );
    return {
      ok: true,
      count: result.items.length,
      items: result.items.map((it, i) => ({
        position: i + 1,
        text: it.text,
        due_at: it.due_at,
      })),
    };
  },
};
