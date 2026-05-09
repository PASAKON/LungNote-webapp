import "server-only";
import { z } from "zod";
import { updateUserMemory } from "../../user_memory";
import type { AgentTool } from "../../tool";

const args = z.object({
  action: z
    .enum(["set", "delete"])
    .describe("'set' overwrites or merges; 'delete' removes the key."),
  key: z
    .string()
    .min(1)
    .max(60)
    .describe("Camel/snake key, e.g. 'name', 'university', 'subjects'."),
  value: z
    .unknown()
    .describe(
      "Any JSON value for set. For arrays, server merges with existing array (union). Ignored for delete.",
    ),
});

export const updateMemoryTool: AgentTool<z.infer<typeof args>> = {
  name: "update_memory",
  category: "profile",
  description:
    "Persist a long-term fact about this user (across conversations). Call when the user shares stable info: name, university, year, role, preferences, recurring subjects. Don't call for transient state (today's mood, current task) — use save_memory for todos and conversation memory for short-term context. Existing array values get UNIONed when value is also an array.",
  schema: args,
  requires: ["linked"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const updated = await updateUserMemory(
      ctx.lineUserId,
      input.action,
      input.key,
      input.value,
    );
    return {
      ok: true,
      action: input.action,
      key: input.key,
      memory_keys: Object.keys(updated),
    };
  },
};
