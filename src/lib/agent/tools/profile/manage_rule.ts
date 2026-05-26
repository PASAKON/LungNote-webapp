import "server-only";
import { z } from "zod";
import { addRule, removeRule, listRules } from "../../user_memory";
import type { AgentTool } from "../../tool";

const args = z.object({
  action: z
    .enum(["add", "remove", "list"])
    .describe("'add' creates/updates a rule, 'remove' deletes by id, 'list' returns all."),
  when: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("add only: the trigger — when this situation happens. e.g. 'เจอเมลที่ต้อง approve'."),
  then: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("add only: what to do when triggered. e.g. 'เอาเข้า to-do แล้วทำปุ่ม Approve'."),
  ask: z
    .union([z.literal(0), z.literal(1), z.literal(2)])
    .optional()
    .describe("add only: 0 = do immediately, 1 = ask once before doing, 2 = just warn the user it applies."),
  id: z
    .string()
    .max(32)
    .optional()
    .describe("remove: the rule id to delete. add: optional explicit id (else derived from `when`)."),
});

export const manageRuleTool: AgentTool<z.infer<typeof args>> = {
  name: "manage_rule",
  category: "profile",
  description:
    "Manage the user's STANDING RULES (directives like 'when X, always do Y'). Call action='add' when the user gives a recurring instruction ('ทุกครั้งที่...', 'พอเจอ...ให้...', 'จำไว้ว่าเวลา...'). Call action='remove' when they say to forget/stop a rule. Call action='list' when they ask what rules/directives are saved. Rules are auto-loaded into context every turn — you must honour them per their `a` (ask) mode.",
  schema: args,
  requires: ["linked"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };

    if (input.action === "list") {
      const rules = await listRules(ctx.lineUserId);
      return { ok: true, action: "list", rules, count: rules.length };
    }

    if (input.action === "remove") {
      if (!input.id) return { ok: false, reason: "id_required" };
      const rules = await removeRule(ctx.lineUserId, input.id);
      return { ok: true, action: "remove", id: input.id, count: rules.length };
    }

    // add
    if (!input.when || !input.then) {
      return { ok: false, reason: "when_and_then_required" };
    }
    const rules = await addRule(ctx.lineUserId, {
      when: input.when,
      do: input.then,
      ask: input.ask ?? 1,
      id: input.id,
    });
    return { ok: true, action: "add", count: rules.length, rules };
  },
};
