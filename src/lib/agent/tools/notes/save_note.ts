import "server-only";
import { z } from "zod";
import { saveNoteRaw } from "@/lib/notes/save";
import type { AgentTool } from "../../tool";

const args = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "Note title. For URL saves use the URL itself. For free-form notes use a short summary.",
    ),
  body: z
    .string()
    .nullish()
    .describe(
      "Optional note body. Use for the user's own comment that accompanies the URL or note.",
    ),
});

/**
 * save_note — creates a row in lungnote_notes (NOT lungnote_todos).
 * Appears on the dashboard's "โน้ตล่าสุด" (Recent Notes) list rather than
 * the todo list. Used for URL captures and free-form notes that aren't
 * action items.
 */
export const saveNoteTool: AgentTool<z.infer<typeof args>> = {
  name: "save_note",
  category: "memory",
  description:
    "Create a top-level note (appears in 'Recent Notes' on the dashboard). Use for URL captures and standalone notes — NOT for todos / reminders (use save_memory for those).",
  schema: args,
  requires: ["linked"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) {
      return { ok: false, reason: "not_linked" };
    }
    const result = await saveNoteRaw({
      lineUserId: ctx.lineUserId,
      title: input.title,
      body: input.body ?? "",
    });
    if (!result.ok) {
      return { ok: false, reason: result.reason, error: result.error };
    }
    return { ok: true, noteId: result.noteId, title: result.title };
  },
};
